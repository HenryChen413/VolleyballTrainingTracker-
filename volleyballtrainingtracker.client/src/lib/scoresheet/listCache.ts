// 記錄單列表的離線快取：保存最後一次成功取得的 list 回應，供離線時顯示列表、
// 取得對手／名單、判斷可開啟的局號；並合併本機尚未同步的草稿
import type { MatchScoreSheetDto, MatchScoreSheetsResponse } from '@/api/scoreSheets';
import { normalizeContent, type SheetContent } from './sheet';
import { listSheetDrafts, readSheetDraft } from './useSheetSync';

const cacheKey = (matchLogId: number) => `scoresheet-list:${matchLogId}`;

/** 讀取快取；沒有、格式不符或 localStorage 無法使用時回 null */
export function readListCache(matchLogId: number): MatchScoreSheetsResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(matchLogId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<MatchScoreSheetsResponse> | null;
    if (!d || typeof d !== 'object' || !Array.isArray(d.sheets) || !Array.isArray(d.roster)) return null;
    return {
      matchLogId,
      matchEventId: typeof d.matchEventId === 'number' ? d.matchEventId : 0,
      opponent: typeof d.opponent === 'string' ? d.opponent : '—',
      matchDate: typeof d.matchDate === 'string' ? d.matchDate : '',
      matchType: typeof d.matchType === 'string' ? d.matchType : null,
      ourSquad: typeof d.ourSquad === 'string' ? d.ourSquad : null,
      roster: d.roster.filter((p) => !!p && typeof p === 'object' && Number.isInteger(p.playerId)),
      sheets: d.sheets.filter(
        (s) => !!s && typeof s === 'object' && Number.isInteger(s.setIndex) && typeof s.version === 'number',
      ),
    };
  } catch {
    return null;
  }
}

/** 寫入快取（每次成功取得 list 後呼叫）；失敗就略過 */
export function writeListCache(data: MatchScoreSheetsResponse) {
  try {
    localStorage.setItem(cacheKey(data.matchLogId), JSON.stringify(data));
  } catch {
    /* 忽略 */
  }
}

/** 列表上一局的顯示資料 */
export interface SheetCard {
  setIndex: number;
  content: SheetContent;
  recorderName: string | null;
  /** ISO 時間字串 */
  updatedAt: string;
  /** 本機有尚未上傳的修改 */
  unsynced: boolean;
  /** 伺服器（或快取）上有這一局 */
  onServer: boolean;
}

/**
 * 離線顯示：以快取的各局為基礎，合併本機草稿。
 * 草稿有未上傳修改、或版本比快取新時以草稿內容為準；只存在於本機的局另外列出。
 */
export function mergeOfflineCards(cache: MatchScoreSheetsResponse | null, matchLogId: number): SheetCard[] {
  const drafts = listSheetDrafts(matchLogId);
  const cards: SheetCard[] = (cache?.sheets ?? []).map((s) => {
    const d = drafts.find((x) => x.setIndex === s.setIndex)?.draft;
    const useDraft = !!d && (d.dirty || d.baseVersion > s.version);
    return {
      setIndex: s.setIndex,
      content: useDraft ? d.content : normalizeContent(s.content),
      recorderName: useDraft ? d.recorderName : s.recorderName,
      updatedAt: useDraft ? new Date(d.savedAt).toISOString() : s.updatedAt,
      unsynced: !!d?.dirty,
      onServer: true,
    };
  });
  for (const { setIndex, draft } of drafts) {
    if (cards.some((c) => c.setIndex === setIndex)) continue;
    cards.push({
      setIndex,
      content: draft.content,
      recorderName: draft.recorderName,
      updatedAt: new Date(draft.savedAt).toISOString(),
      unsynced: draft.dirty,
      onServer: false,
    });
  }
  return cards.sort((a, b) => a.setIndex - b.setIndex);
}

/** 離線時可開啟的最大局號基準：快取各局與本機草稿中的最大局號 */
export function offlineMaxIndex(cache: MatchScoreSheetsResponse | null, matchLogId: number): number {
  const fromCache = (cache?.sheets ?? []).reduce((m, s) => Math.max(m, s.setIndex), 0);
  return listSheetDrafts(matchLogId).reduce((m, d) => Math.max(m, d.setIndex), fromCache);
}

/** 局號上限（與後端一致） */
export const MAX_SET_INDEX = 50;

/**
 * 離線開啟某一局：以即時資料（若有）或快取取得對手、名單與各局，並判斷局號是否可開啟。
 * 可開啟：快取上已有此局、本機有此局草稿，或為下一局（快取與草稿中最大局號＋1）。
 * 本機草稿已同步（非 dirty）且版本比快取新時，以草稿作為伺服器內容（快取可能比草稿舊）。
 */
export function openSheetOffline(
  matchLogId: number,
  setIndex: number,
  live: MatchScoreSheetsResponse | null,
): { data: MatchScoreSheetsResponse; server: MatchScoreSheetDto | null; valid: boolean } {
  const base = live ?? readListCache(matchLogId);
  const data: MatchScoreSheetsResponse = base ?? {
    matchLogId,
    matchEventId: 0,
    opponent: '—',
    matchDate: '',
    matchType: null,
    ourSquad: null,
    roster: [],
    sheets: [],
  };
  const draft = readSheetDraft(matchLogId, setIndex);
  const cached = data.sheets.find((s) => s.setIndex === setIndex) ?? null;
  const maxIndex = offlineMaxIndex(data, matchLogId);
  const valid =
    Number.isInteger(setIndex) &&
    setIndex > 0 &&
    (cached !== null || draft !== null || (setIndex === maxIndex + 1 && setIndex <= MAX_SET_INDEX));
  const server: MatchScoreSheetDto | null =
    draft && !draft.dirty && (!cached || draft.baseVersion > cached.version)
      ? {
          setIndex,
          recorderName: draft.recorderName,
          content: draft.content,
          version: draft.baseVersion,
          updatedAt: new Date(draft.savedAt).toISOString(),
          updatedByName: null,
        }
      : cached;
  return { data, server, valid };
}
