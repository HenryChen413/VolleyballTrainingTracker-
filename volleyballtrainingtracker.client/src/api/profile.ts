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

export const profileApi = {
  get: () => api.get<AuthUser>('/Profile').then((r) => r.data),
  update: (payload: ProfileUpdate) => api.put<AuthUser>('/Profile', payload).then((r) => r.data),
  changePassword: (payload: ChangePassword) =>
    api.put('/Profile/password', payload).then((r) => r.data),
};
