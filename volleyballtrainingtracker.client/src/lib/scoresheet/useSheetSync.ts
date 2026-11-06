import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSheetConflict, scoreSheetsApi, type MatchScoreSheetDto } from '@/api/scoreSheets';
import { emptyContent, normalizeContent, type SheetContent } from './sheet';

/**
 * saved：已同步；pending／saving：同步中；offline：網路或伺服器暫時錯誤，會自動重試；
 * error：伺服器拒絕（400／403／404 等），停止自動重試，需使用者按「重試」；conflict：版本衝突待選擇
 */
export type SyncStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict';

const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;
/** 本機最多記住幾份「已送出但未確認」的內容（回應遺失時用來辨認自己造成的 409） */
const MAX_SENT = 20;

/** 一次上傳的內容（用來比對伺服器上的版本是否就是自己送的） */
export interface SentSheet {
  content: SheetContent;
  recorderName: string | null;
}

export interface Draft {
  content: SheetContent;
  recorderName: string | null;
  baseVersion: number;
  dirty: boolean;
  savedAt: number;
  /** 以 baseVersion 為基準送出、但尚未確認結果的內容（回應可能已遺失） */
  sent: SentSheet[];
}

interface ConflictInfo {
  version: number;
  updatedByName: string | null;
}

const DRAFT_PREFIX = 'scoresheet:';
const storageKey = (matchLogId: number, setIndex: number) => `${DRAFT_PREFIX}${matchLogId}:${setIndex}`;

/**
 * 進行中的上傳（模組層級，以 storage key 區分）。離開再進入同一局時，新的 hook 實例
 * 須等舊實例的請求結束、再讀本機草稿的版本號，才不會以舊版本號同時上傳造成假衝突。
 */
const inFlight = new Map<string, Promise<void>>();

/** 測試用：清掉模組層級的上傳追蹤 */
export function resetSheetSyncForTests() {
  inFlight.clear();
}

function parseSent(raw: unknown): SentSheet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      content: normalizeContent(x.content),
      recorderName: typeof x.recorderName === 'string' ? x.recorderName : null,
    }));
}

// localStorage 在隱私模式等情況可能丟例外，一律吞掉，改以記憶體運作
function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft> | null;
    if (!d || typeof d !== 'object') return null;
    return {
      content: normalizeContent(d.content),
      recorderName: typeof d.recorderName === 'string' ? d.recorderName : null,
      baseVersion: typeof d.baseVersion === 'number' ? d.baseVersion : 0,
      dirty: d.dirty === true,
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
      sent: parseSent(d.sent),
    };
  } catch {
    return null;
  }
}

/** 讀取某局的本機草稿（離線開啟用）；沒有或無法讀取時回 null */
export function readSheetDraft(matchLogId: number, setIndex: number): Draft | null {
  return readDraft(storageKey(matchLogId, setIndex));
}

/** 列出某場比賽所有局的本機草稿（依局號排序）；localStorage 無法使用時回空陣列 */
export function listSheetDrafts(matchLogId: number): { setIndex: number; draft: Draft }[] {
  const prefix = `${DRAFT_PREFIX}${matchLogId}:`;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
    return [];
  }
  const out: { setIndex: number; draft: Draft }[] = [];
  for (const k of keys) {
    const setIndex = Number(k.slice(prefix.length));
    if (!Number.isInteger(setIndex) || setIndex <= 0) continue;
    const draft = readDraft(k);
    if (draft) out.push({ setIndex, draft });
  }
  return out.sort((a, b) => a.setIndex - b.setIndex);
}

function writeDraft(key: string, d: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* 忽略，僅以記憶體運作 */
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

/** 刪除某局後清掉其本機草稿，避免日後新增同局號時載入舊的未上傳草稿 */
export function clearSheetDraft(matchLogId: number, setIndex: number) {
  clearDraft(storageKey(matchLogId, setIndex));
}

/** 兩份內容（含記錄人）是否相同；先正規化，避免欄位順序不同造成誤判 */
function sameSheet(a: SentSheet, b: SentSheet): boolean {
  return (
    a.recorderName === b.recorderName &&
    JSON.stringify(normalizeContent(a.content)) === JSON.stringify(normalizeContent(b.content))
  );
}

/**
 * 已卸載的實例確認伺服器版本後，只更新本機草稿的版本號：
 * 若新的實例已寫入較新的內容，不能被舊實例的內容蓋掉
 */
function patchDraftVersion(key: string, version: number, server: SentSheet) {
  const d = readDraft(key);
  if (!d) return;
  writeDraft(key, { ...d, baseVersion: version, sent: [], dirty: d.dirty && !sameSheet(d, server), savedAt: Date.now() });
}

/** 永久性錯誤（不自動重試）：409 以外的 4xx，但逾時（408）與流量限制（429）仍視為暫時性 */
function permanentError(err: unknown): string | null {
  const e = err as { response?: { status?: number; data?: { message?: unknown } } };
  const st = e?.response?.status;
  if (typeof st !== 'number' || st < 400 || st >= 500 || st === 409 || st === 408 || st === 429) return null;
  const msg = e.response?.data?.message;
  return typeof msg === 'string' && msg !== '' ? msg : `HTTP ${st}`;
}

interface Args {
  matchLogId: number;
  setIndex: number;
  /** null 代表此局尚未存在於伺服器（baseVersion 0）。hook 只在掛載時取用，呼叫端應以 key 區分不同局 */
  server: MatchScoreSheetDto | null;
}

export function useSheetSync({ matchLogId, setIndex, server }: Args) {
  const key = storageKey(matchLogId, setIndex);
  const queryClient = useQueryClient();

  // 初始狀態：本機有未上傳草稿就用草稿，否則用伺服器內容
  const [init] = useState(() => {
    const draft = readDraft(key);
    if (draft?.dirty) return { ...draft, fromDraft: true };
    return {
      content: server ? normalizeContent(server.content) : emptyContent(),
      recorderName: server?.recorderName ?? null,
      baseVersion: server?.version ?? 0,
      dirty: false,
      sent: [] as SentSheet[],
      fromDraft: false,
    };
  });

  const [content, setContent] = useState<SheetContent>(init.content);
  const [recorderName, setRecorderNameState] = useState<string | null>(init.recorderName);
  const [status, setStatus] = useState<SyncStatus>(init.fromDraft ? 'pending' : 'saved');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const contentRef = useRef(content);
  const recorderRef = useRef(recorderName);
  const baseVersionRef = useRef(init.baseVersion);
  const dirtyRef = useRef(init.dirty);
  const sentRef = useRef<SentSheet[]>(init.sent);
  const seqRef = useRef(0); // 每次本機變動遞增（resolveConflict 用來判斷期間是否有新內容）
  const ownInFlightRef = useRef(false); // 本實例的請求（含 409 後的比對）進行中
  const waitingRef = useRef(false); // 正在等其他實例的請求結束
  const conflictRef = useRef<ConflictInfo | null>(null);
  const errorRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const uploadRef = useRef<() => void>(() => {});

  const clearTimers = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    debounceRef.current = null;
    retryRef.current = null;
  };

  const persist = useCallback(() => {
    writeDraft(key, {
      content: contentRef.current,
      recorderName: recorderRef.current,
      baseVersion: baseVersionRef.current,
      dirty: dirtyRef.current,
      savedAt: Date.now(),
      sent: sentRef.current,
    });
  }, [key]);

  /** 回填局分後，比賽紀錄頁的快取已過期 */
  const invalidateMatchEvents = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['match-events'] });
  }, [queryClient]);

  /** 伺服器已確認為 version、內容為 onServer：更新版本號，內容相同就標為已同步，否則以新版本號再送 */
  const confirmServer = useCallback(
    (version: number, onServer: SentSheet) => {
      if (unmountedRef.current) {
        patchDraftVersion(key, version, onServer);
        return;
      }
      baseVersionRef.current = version;
      sentRef.current = [];
      if (sameSheet({ content: contentRef.current, recorderName: recorderRef.current }, onServer)) {
        dirtyRef.current = false;
        persist();
        setStatus('saved');
      } else {
        persist();
        uploadRef.current();
      }
    },
    [key, persist],
  );

  const scheduleRetry = () => {
    if (unmountedRef.current) return;
    setStatus('offline');
    retryRef.current = setTimeout(() => uploadRef.current(), RETRY_MS);
  };

  const showConflict = useCallback((info: ConflictInfo) => {
    // 409 停止自動重試，等使用者選擇
    conflictRef.current = info;
    clearTimers();
    if (!unmountedRef.current) {
      setConflict(info);
      setStatus('conflict');
    }
  }, []);

  const upload = useCallback(() => {
    // 不同時送兩個請求；進行中的請求結束後會比對內容判斷是否需要再送
    if (ownInFlightRef.current || waitingRef.current) return;
    if (conflictRef.current || errorRef.current || !dirtyRef.current) return;
    clearTimers();

    const other = inFlight.get(key);
    if (other) {
      // 另一個實例（例如剛離開的同一局）仍在上傳：等它結束，再以本機草稿上的最新版本號上傳
      waitingRef.current = true;
      if (!unmountedRef.current) setStatus('saving');
      void other.then(() => {
        waitingRef.current = false;
        const d = readDraft(key);
        if (d) {
          baseVersionRef.current = d.baseVersion;
          sentRef.current = d.sent;
          if (unmountedRef.current) {
            // 本實例已卸載：可能已有新實例寫入更新的草稿，改以草稿內容為準
            contentRef.current = d.content;
            recorderRef.current = d.recorderName;
            dirtyRef.current = d.dirty;
          }
        }
        uploadRef.current();
      });
      return;
    }

    const attempt: SentSheet = { content: contentRef.current, recorderName: recorderRef.current };
    const expectedVersion = baseVersionRef.current;
    // 送出前先記下：回應若遺失，之後收到 409 時才認得出伺服器上的就是自己送的內容
    sentRef.current = [...sentRef.current, attempt].slice(-MAX_SENT);
    persist();
    ownInFlightRef.current = true;
    if (!unmountedRef.current) setStatus('saving');

    let tracked: Promise<void> | null = null;
    const release = () => {
      ownInFlightRef.current = false;
      if (inFlight.get(key) === tracked) inFlight.delete(key);
    };

    tracked = scoreSheetsApi
      .save(matchLogId, setIndex, { ...attempt, expectedVersion })
      .then(
        (res) => {
          release();
          invalidateMatchEvents();
          confirmServer(res.version, attempt);
        },
        (err: unknown) => {
          const c = getSheetConflict(err);
          if (c) {
            // 409：先看伺服器上的內容是不是自己先前送出、但回應遺失的那一份
            const candidates = sentRef.current;
            return scoreSheetsApi.list(matchLogId).then(
              (res) => {
                release();
                const s = res.sheets.find((x) => x.setIndex === setIndex) ?? null;
                const onServer: SentSheet | null = s
                  ? { content: normalizeContent(s.content), recorderName: s.recorderName ?? null }
                  : null;
                if (s && onServer && candidates.some((x) => sameSheet(x, onServer))) {
                  invalidateMatchEvents();
                  confirmServer(s.version, onServer);
                  return;
                }
                showConflict({ version: c.version, updatedByName: c.updatedByName ?? null });
              },
              () => {
                // 取不到伺服器資料，無法判斷是否為真衝突：先當離線，稍後重試
                release();
                scheduleRetry();
              },
            );
          }
          release();
          const msg = permanentError(err);
          if (msg !== null) {
            // 伺服器明確拒絕，這次的內容確定沒寫入；保留草稿，停止自動重試
            sentRef.current = sentRef.current.filter((x) => x !== attempt);
            errorRef.current = msg;
            if (!unmountedRef.current) {
              persist();
              setErrorMessage(msg);
              setStatus('error');
            }
            return;
          }
          // 網路錯誤或 5xx：保留草稿，稍後重試
          scheduleRetry();
        },
      );
    inFlight.set(key, tracked);
  }, [matchLogId, setIndex, key, persist, invalidateMatchEvents, confirmServer, showConflict]);

  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);

  const markChanged = useCallback(() => {
    seqRef.current += 1;
    dirtyRef.current = true;
    persist();
    if (conflictRef.current || errorRef.current) return; // 衝突或錯誤期間只存本機，不自動上傳
    if (ownInFlightRef.current || waitingRef.current) return; // 上傳完成後會自動以最新內容再送
    setStatus((s) => (s === 'offline' ? s : 'pending'));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => uploadRef.current(), DEBOUNCE_MS);
  }, [persist]);

  const update = useCallback(
    (fn: (c: SheetContent) => SheetContent) => {
      contentRef.current = fn(contentRef.current);
      setContent(contentRef.current);
      markChanged();
    },
    [markChanged],
  );

  const setRecorderName = useCallback(
    (n: string | null) => {
      recorderRef.current = n;
      setRecorderNameState(n);
      markChanged();
    },
    [markChanged],
  );

  /** 無法同步（error）後由使用者手動重試 */
  const retry = useCallback(() => {
    if (!errorRef.current) return;
    errorRef.current = null;
    setErrorMessage(null);
    setStatus('pending');
    uploadRef.current();
  }, []);

  const resolveConflict = useCallback(
    (choice: 'mine' | 'server' | 'discard'): Promise<boolean> => {
      const c = conflictRef.current;
      if (!c) return Promise.resolve(false);
      if (choice === 'mine') {
        // 以伺服器目前版本為基準重送（version 0 代表該局已不存在，視為新增）
        baseVersionRef.current = c.version;
        sentRef.current = [];
        conflictRef.current = null;
        // 立即寫入本機，避免重送完成前重新整理又以舊版本號造成衝突
        persist();
        setConflict(null);
        uploadRef.current();
        return Promise.resolve(true);
      }
      if (choice === 'discard') {
        // 捨棄本機版本（伺服器上此局已被刪除時）：清掉草稿並停止同步，由呼叫端返回列表
        clearTimers();
        seqRef.current += 1;
        dirtyRef.current = false;
        sentRef.current = [];
        conflictRef.current = null;
        clearDraft(key);
        setConflict(null);
        setStatus('saved');
        return Promise.resolve(true);
      }
      // 回傳 true＝已改用伺服器版本；false＝取不到伺服器資料，衝突維持
      return scoreSheetsApi
        .list(matchLogId)
        .then((res) => {
          const s = res.sheets.find((x) => x.setIndex === setIndex) ?? null;
          clearTimers();
          seqRef.current += 1;
          contentRef.current = s ? normalizeContent(s.content) : emptyContent();
          recorderRef.current = s?.recorderName ?? null;
          baseVersionRef.current = s?.version ?? 0;
          dirtyRef.current = false;
          sentRef.current = [];
          conflictRef.current = null;
          clearDraft(key);
          if (unmountedRef.current) return true;
          setContent(contentRef.current);
          setRecorderNameState(recorderRef.current);
          setConflict(null);
          setStatus('saved');
          return true;
        })
        .catch(() => {
          // 取不到伺服器版本：維持衝突狀態，使用者可再試
          return false;
        });
    },
    [matchLogId, setIndex, key, persist],
  );

  useEffect(() => {
    unmountedRef.current = false;
    // 載入時若有本機草稿，立即上傳
    if (dirtyRef.current) uploadRef.current();
    const onOnline = () => uploadRef.current();
    const onBeforeUnload = () => uploadRef.current();
    window.addEventListener('online', onOnline);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // 卸載時若仍有排程中的上傳，立即送出
      const pending = debounceRef.current !== null || retryRef.current !== null;
      unmountedRef.current = true;
      if (pending) uploadRef.current();
      clearTimers();
    };
  }, []);

  return {
    content,
    recorderName,
    status,
    conflict,
    errorMessage,
    update,
    setRecorderName,
    resolveConflict,
    retry,
  };
}
