import { api } from './client';

export interface UserListItem {
  id: number;
  userName: string;
  email: string;
  displayName?: string | null;
  roleId: number;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserCreatePayload {
  userName: string;
  password: string;
  displayName?: string;
  email?: string;
  roleId: number;
  isActive: boolean;
}

export interface UserUpdatePayload {
  displayName?: string;
  email?: string;
  password?: string;
  roleId?: number;
}

export const usersApi = {
  list: () => api.get<UserListItem[]>('/Users').then((r) => r.data),
  create: (payload: UserCreatePayload) =>
    api.post<UserListItem>('/Users', payload).then((r) => r.data),
  update: (id: number, payload: UserUpdatePayload) =>
    api.put(`/Users/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/Users/${id}`).then((r) => r.data),
  setRole: (id: number, roleId: number) =>
    api.put(`/Users/${id}/role`, { roleId }).then((r) => r.data),
  setActive: (id: number, isActive: boolean) =>
    api.put(`/Users/${id}/active`, { isActive }).then((r) => r.data),
};
