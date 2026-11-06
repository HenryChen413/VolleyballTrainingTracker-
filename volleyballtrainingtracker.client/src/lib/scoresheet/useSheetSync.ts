import { useCallback, useEffect, useRef, useState } from 'react';
import { getSheetConflict, scoreSheetsApi, type MatchScoreSheetDto } from '@/api/scoreSheets';
import { emptyContent, normalizeContent, type SheetContent } from './sheet';

export type SyncStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'conflict';

const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;

export interface Draft {
  content: SheetContent;
  recorderName: string | null;
  baseVersion: number;
  dirty: boolean;
  savedAt: number;
}

interface ConflictInfo {
  version: number;
  updatedByName: string | null;
}

const storageKey = (matchLogId: number, setIndex: number) => `scoresheet:${matchLogId}:${setIndex}`;

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
    };
  } catch {
    return null;
  }
}

/** 讀取某局的本機草稿（離線開啟用）；沒有或無法讀取時回 null */
export function readSheetDraft(matchLogId: number, setIndex: number): Draft | null {
  return readDraft(storageKey(matchLogId, setIndex));
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

interface Args {
  matchLogId: number;
  setIndex: number;
  /** null 代表此局尚未存在於伺服器（baseVersion 0）。hook 只在掛載時取用，呼叫端應以 key 區分不同局 */
  server: MatchScoreSheetDto | null;
}

export function useSheetSync({ matchLogId, setIndex, server }: Args) {
  const key = storageKey(matchLogId, setIndex);

  // 初始狀態：本機有未上傳草稿就用草稿，否則用伺服器內容
  const [init] = useState(() => {
    const draft = readDraft(key);
    if (draft?.dirty) return { ...draft, fromDraft: true };
    return {
      content: server ? normalizeContent(server.content) : emptyContent(),
      recorderName: server?.recorderName ?? null,
      baseVersion: server?.version ?? 0,
      dirty: false,
      fromDraft: false,
    };
  });

  const [content, setContent] = useState<SheetContent>(init.content);
  const [recorderName, setRecorderNameState] = useState<string | null>(init.recorderName);
  const [status, setStatus] = useState<SyncStatus>(init.fromDraft ? 'pending' : 'saved');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  const contentRef = useRef(content);
  const recorderRef = useRef(recorderName);
  const baseVersionRef = useRef(init.baseVersion);
  const dirtyRef = useRef(init.dirty);
  const seqRef = useRef(0); // 每次本機變動遞增，用來判斷上傳期間是否又有新內容
  const inFlightRef = useRef(false);
  const conflictRef = useRef<ConflictInfo | null>(null);
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
    });
  }, [key]);

  const upload = useCallback(() => {
    // 不同時送兩個請求；進行中的請求結束後會依 seq 判斷是否需要再送
    if (inFlightRef.current || conflictRef.current || !dirtyRef.current) return;
    clearTimers();
    inFlightRef.current = true;
    const seq = seqRef.current;
    if (!unmountedRef.current) setStatus('saving');
    scoreSheetsApi
      .save(matchLogId, setIndex, {
        recorderName: recorderRef.current,
        content: contentRef.current,
        expectedVersion: baseVersionRef.current,
      })
      .then((res) => {
        inFlightRef.current = false;
        baseVersionRef.current = res.version;
        if (seqRef.current === seq) {
          dirtyRef.current = false;
          persist();
          if (!unmountedRef.current) setStatus('saved');
        } else {
          // 上傳期間又有變動：以最新內容和新版本號再送
          persist();
          uploadRef.current();
        }
      })
      .catch((err: unknown) => {
        inFlightRef.current = false;
        const c = getSheetConflict(err);
        if (c) {
          // 409 停止自動重試，等使用者選擇
          const info = { version: c.version, updatedByName: c.updatedByName ?? null };
          conflictRef.current = info;
          clearTimers();
          if (!unmountedRef.current) {
            setConflict(info);
            setStatus('conflict');
          }
          return;
        }
        // 網路錯誤、5xx 或其他 4xx：保留草稿，稍後重試
        if (unmountedRef.current) return;
        setStatus('offline');
        retryRef.current = setTimeout(() => uploadRef.current(), RETRY_MS);
      });
  }, [matchLogId, setIndex, persist]);

  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);

  const markChanged = useCallback(() => {
    seqRef.current += 1;
    dirtyRef.current = true;
    persist();
    if (conflictRef.current) return; // 衝突期間只存本機，不自動上傳
    if (inFlightRef.current) return; // 上傳完成後會自動以最新內容再送
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

  const resolveConflict = useCallback(
    (choice: 'mine' | 'server'): Promise<boolean> => {
      const c = conflictRef.current;
      if (!c) return Promise.resolve(false);
      if (choice === 'mine') {
        // 以伺服器目前版本為基準重送（version 0 代表該局已不存在，視為新增）
        baseVersionRef.current = c.version;
        conflictRef.current = null;
        // 立即寫入本機，避免重送完成前重新整理又以舊版本號造成衝突
        persist();
        setConflict(null);
        uploadRef.current();
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

  return { content, recorderName, status, conflict, update, setRecorderName, resolveConflict };
}
