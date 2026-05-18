import { api } from './client';

// ── 子層：每筆對戰 ─────────────────────────────────────────────────────
export interface MatchLogItem {
  id: number;
  opponent: string;
  ourSquad: string | null;
  set1Our: number | null;
  set1Opp: number | null;
  set2Our: number | null;
  set2Opp: number | null;
  set3Our: number | null;
  set3Opp: number | null;
  ourScore: number | null;
  opponentScore: number | null;
  result: string | null;
}

export interface MatchLogUpsert {
  id?: number | null;
  opponent: string;
  ourSquad?: string | null;
  set1Our?: number | null;
  set1Opp?: number | null;
  set2Our?: number | null;
  set2Opp?: number | null;
  set3Our?: number | null;
  set3Opp?: number | null;
  ourScore?: number | null;
  opponentScore?: number | null;
  result?: string | null;
}

// ── 父層：一場賽事 ─────────────────────────────────────────────────────
export interface MatchEventPlayerInfo {
  playerId: number;
  name: string;
  jerseyNo: number | null;
  position: string | null;
  ourSquad: string | null;
}

export interface MatchEventListItem {
  id: number;
  matchDate: string;
  matchType: string | null;
  academicYear: number | null;
  matchName: string | null;
  location: string | null;
  ranking: string | null;
  rankingB: string | null;
  videoUrl: string | null;
  notes: string | null;
  squadCount: number;
  playerCount: number;
  players: MatchEventPlayerInfo[];
  matches: MatchLogItem[];
}

export interface MatchEventDetail {
  id: number;
  matchDate: string;
  matchType: string | null;
  academicYear: number | null;
  matchName: string | null;
  location: string | null;
  ranking: string | null;
  rankingB: string | null;
  videoUrl: string | null;
  notes: string | null;
  squadCount: number;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
  players: MatchEventPlayerInfo[];
  matches: MatchLogItem[];
}

export interface MatchEventPlayerInput {
  playerId: number;
  ourSquad: string | null;
}

export interface MatchEventUpsert {
  matchDate: string;
  matchType?: string | null;
  academicYear?: number | null;
  matchName?: string | null;
  location?: string | null;
  ranking?: string | null;
  rankingB?: string | null;
  videoUrl?: string | null;
  notes?: string | null;
  squadCount: number;
  players: MatchEventPlayerInput[];
  matches: MatchLogUpsert[];
}

export const matchEventsApi = {
  list: () => api.get<MatchEventListItem[]>('/MatchEvents').then((r) => r.data),
  get: (id: number) => api.get<MatchEventDetail>(`/MatchEvents/${id}`).then((r) => r.data),
  create: (data: MatchEventUpsert) =>
    api.post<MatchEventDetail>('/MatchEvents', data).then((r) => r.data),
  update: (id: number, data: MatchEventUpsert) =>
    api.put<MatchEventDetail>(`/MatchEvents/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/MatchEvents/${id}`).then(() => {}),
};
