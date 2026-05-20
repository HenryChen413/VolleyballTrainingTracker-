import { api } from './client';
import type { AuthUser } from '@/stores/authStore';

export interface ProfileUpdate {
  email: string;
  displayName?: string | null;
}

export interface ChangePassword {
  currentPassword: string;
  newPassword: string;
}

export interface MyMatchAppearance {
  matchEventId: number;
  matchDate: string;
  matchType: string | null;
  matchName: string | null;
  ourSquad: string | null;
}

export interface MyPlayerInfo {
  id: number;
  studentId: string | null;
  name: string;
  nickname: string | null;
  jerseyNo: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  dominantHand: string | null;
  grade: number | null;
  isActive: number;
  joinedAt: string;
  matchAppearanceCount: number;
  officialAppearanceCount: number;
  appearances: MyMatchAppearance[];
}

export const profileApi = {
  get: () => api.get<AuthUser>('/Profile').then((r) => r.data),
  update: (payload: ProfileUpdate) => api.put<AuthUser>('/Profile', payload).then((r) => r.data),
  changePassword: (payload: ChangePassword) =>
    api.put('/Profile/password', payload).then((r) => r.data),
  /** 取得目前登入者綁定的選手檔案；未綁定時後端回 404。 */
  getPlayer: () => api.get<MyPlayerInfo>('/Profile/player').then((r) => r.data),
};
