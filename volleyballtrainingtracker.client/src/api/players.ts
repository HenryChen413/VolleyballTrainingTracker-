import { api } from './client';

export const PLAYER_STATUS = {
  Graduated: 0,
  Active: 1,
  Left: 2,
} as const;

export type PlayerStatus = (typeof PLAYER_STATUS)[keyof typeof PLAYER_STATUS];

export const PLAYER_STATUS_LABEL: Record<PlayerStatus, string> = {
  [PLAYER_STATUS.Active]: '現役',
  [PLAYER_STATUS.Graduated]: '畢業',
  [PLAYER_STATUS.Left]: '退隊',
};

export interface Player {
  id: number;
  userId: number | null;
  name: string;
  nickname: string | null;
  jerseyNo: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  dominantHand: string | null;
  birthDate: string | null;
  joinedAt: string;
  grade: number | null;
  isActive: PlayerStatus;
  notes: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface PlayerUpsert {
  userId?: number | null;
  name: string;
  nickname?: string | null;
  jerseyNo?: number | null;
  position?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  dominantHand?: string | null;
  birthDate?: string | null;
  joinedAt?: string | null;
  grade?: number | null;
  isActive: PlayerStatus;
  notes?: string | null;
}

export const playersApi = {
  list: (activeOnly = false) =>
    api.get<Player[]>('/Players', { params: { activeOnly } }).then((r) => r.data),
  get: (id: number) => api.get<Player>(`/Players/${id}`).then((r) => r.data),
  create: (data: PlayerUpsert) => api.post<Player>('/Players', data).then((r) => r.data),
  update: (id: number, data: PlayerUpsert) => api.put<Player>(`/Players/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/Players/${id}`).then(() => {}),
  purge: (id: number) => api.delete(`/Players/${id}/purge`).then(() => {}),
};
