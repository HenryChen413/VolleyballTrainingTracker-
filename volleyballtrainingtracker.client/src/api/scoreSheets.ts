import { api } from './client';
import type { SheetContent } from '@/lib/scoresheet/sheet';

export interface SheetRosterPlayer {
  playerId: number;
  name: string;
  jerseyNo: number | null;
  position: string | null;
}

export interface MatchScoreSheetDto {
  setIndex: number;
  recorderName: string | null;
  /** 原始 JSON，使用前須經 normalizeContent */
  content: unknown;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
}

export interface MatchScoreSheetsResponse {
  matchLogId: number;
  matchEventId: number;
  opponent: string;
  matchDate: string;
  matchType: string | null;
  ourSquad: string | null;
  roster: SheetRosterPlayer[];
  sheets: MatchScoreSheetDto[];
}

export interface SheetSaveBody {
  recorderName: string | null;
  content: SheetContent;
  /** 新增的局為 0 */
  expectedVersion: number;
}

export interface SheetConflict {
  message: string;
  /** 0 代表該局在伺服器上已不存在 */
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface SheetStartBody {
  opponent: string;
  /** 分隊賽事為 'A' / 'B'，其餘為 null */
  ourSquad: string | null;
}

export interface SheetStartResult {
  matchLogId: number;
  /** 要開啟的局號（該對戰既有最大局號＋1） */
  setIndex: number;
  /** 是否新建了對戰 */
  created: boolean;
}

export const scoreSheetsApi = {
  /** 從賽事直接開始記錄：依隊別＋對手找到或新建對戰 */
  start: (eventId: number, body: SheetStartBody) =>
    api.post<SheetStartResult>(`/matchevents/${eventId}/sheet-start`, body).then((r) => r.data),
  list: (matchLogId: number) =>
    api.get<MatchScoreSheetsResponse>(`/matchlogs/${matchLogId}/sheets`).then((r) => r.data),
  save: (matchLogId: number, setIndex: number, body: SheetSaveBody) =>
    api.put<MatchScoreSheetDto>(`/matchlogs/${matchLogId}/sheets/${setIndex}`, body).then((r) => r.data),
  remove: (matchLogId: number, setIndex: number) =>
    api.delete(`/matchlogs/${matchLogId}/sheets/${setIndex}`).then(() => undefined),
};

/** PUT 回 409（版本不符）時取出衝突資訊；其他錯誤回 null */
export function getSheetConflict(err: unknown): SheetConflict | null {
  const e = err as { response?: { status?: number; data?: SheetConflict } };
  return e?.response?.status === 409 && e.response.data ? e.response.data : null;
}
