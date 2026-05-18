import { api } from './client';
import type { AuthUser } from '@/stores/authStore';

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export const authApi = {
  login: (userName: string, password: string) =>
    api.post<AuthResponse>('/Auth/login', { userName, password }).then((r) => r.data),
  me: () => api.get<AuthUser>('/Auth/me').then((r) => r.data),
};
