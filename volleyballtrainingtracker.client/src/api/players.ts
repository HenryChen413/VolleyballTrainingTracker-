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
  [PLAYER_STATUS.Left]: '離隊',
};

export const MEMBER_TYPE = {
  Player: 0,
  Coach: 1,
  Manager: 2,
} as const;

export type MemberType = (typeof MEMBER_TYPE)[keyof typeof MEMBER_TYPE];

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  [MEMBER_TYPE.Player]: '選手',
  [MEMBER_TYPE.Coach]: '教練',
  [MEMBER_TYPE.Manager]: '球經',
};

export interface Player {
  id: number;
  userId: number | null;
  studentId: string | null;
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
  memberType: MemberType;
  notes: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface PlayerUpsert {
  userId?: number | null;
  studentId?: string | null;
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
  memberType: MemberType;
  notes?: string | null;
}

export interface PlayerListOptions {
  activeOnly?: boolean;
  memberType?: MemberType;
}

export const playersApi = {
  list: (opts: PlayerListOptions | boolean = {}) => {
    // 相容舊呼叫：playersApi.list(true) -> { activeOnly: true }
    const o: PlayerListOptions = typeof opts === 'boolean' ? { activeOnly: opts } : opts;
    const params: Record<string, string | boolean | number> = {};
    if (o.activeOnly) params.activeOnly = true;
    if (o.memberType != null) params.memberType = o.memberType;
    return api.get<Player[]>('/Players', { params }).then((r) => r.data);
  },
  get: (id: number) => api.get<Player>(`/Players/${id}`).then((r) => r.data),
  create: (data: PlayerUpsert) => api.post<Player>('/Players', data).then((r) => r.data),
  update: (id: number, data: PlayerUpsert) => api.put<Player>(`/Players/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/Players/${id}`).then(() => {}),
  purge: (id: number) => api.delete(`/Players/${id}/purge`).then(() => {}),
};
