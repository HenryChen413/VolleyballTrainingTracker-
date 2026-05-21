import { api } from './client';

export type ScorerKind = 'player' | 'external';

export interface CryingScorer {
  kind: ScorerKind;
  playerId: number | null;
  name: string;
  jerseyNo: number | null;
}

export interface CryingLog {
  id: number;
  occurredAt: string; // YYYY-MM-DD
  crierPlayerId: number;
  crierName: string;
  crierJerseyNo: number | null;
  reason: string;
  notes: string | null;
  scorers: CryingScorer[];
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface CryingLogUpsert {
  occurredAt: string;
  crierPlayerId: number;
  reason: string;
  notes?: string | null;
  scorerPlayerIds: number[];
  scorerExternalNames: string[];
}

export interface CryingPlayerRank {
  kind: ScorerKind;
  playerId: number | null;
  name: string;
  jerseyNo: number | null;
  count: number;
}

export interface CryingPairRank {
  crierId: number;
  crierName: string;
  scorerKind: ScorerKind;
  scorerId: number | null;
  scorerName: string;
  count: number;
}

export interface CryingStats {
  totalLogs: number;
  topCriers: CryingPlayerRank[];
  topScorers: CryingPlayerRank[];
  topPairs: CryingPairRank[];
  recentReasons: string[];
}

export interface CryingListQuery {
  from?: string;
  to?: string;
  crierId?: number;
  culpritId?: number; // 篩選球員加分者
  culpritName?: string; // 篩選外部加分者
}

export interface CryingCrierRef {
  playerId: number;
  name: string;
  jerseyNo: number | null;
}

export interface CryingScorerRef {
  kind: ScorerKind;
  playerId: number | null;
  name: string;
  jerseyNo: number | null;
}

export interface CryingFilterOptions {
  criers: CryingCrierRef[];
  scorers: CryingScorerRef[];
}

export const cryingApi = {
  list: (q: CryingListQuery = {}) =>
    api.get<CryingLog[]>('/crying-logs', { params: q }).then((r) => r.data),
  get: (id: number) => api.get<CryingLog>(`/crying-logs/${id}`).then((r) => r.data),
  create: (data: CryingLogUpsert) =>
    api.post<CryingLog>('/crying-logs', data).then((r) => r.data),
  update: (id: number, data: CryingLogUpsert) =>
    api.put<CryingLog>(`/crying-logs/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/crying-logs/${id}`).then(() => {}),
  stats: (q: { from?: string; to?: string; top?: number } = {}) =>
    api.get<CryingStats>('/crying-logs/stats', { params: q }).then((r) => r.data),
  filterOptions: () =>
    api.get<CryingFilterOptions>('/crying-logs/filter-options').then((r) => r.data),
};
