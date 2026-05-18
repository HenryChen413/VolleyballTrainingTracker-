import { api } from './client';

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  allowedPages: string[];
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export interface RoleUpsert {
  name: string;
  description?: string | null;
  allowedPages: string[];
  permissions: string[];
}

export interface RoleCatalog {
  allPermissions: string[];
  allPages: string[];
}

export const rolesApi = {
  catalog: () => api.get<RoleCatalog>('/Roles/catalog').then((r) => r.data),
  list: () => api.get<Role[]>('/Roles').then((r) => r.data),
  get: (id: number) => api.get<Role>(`/Roles/${id}`).then((r) => r.data),
  create: (payload: RoleUpsert) => api.post<Role>('/Roles', payload).then((r) => r.data),
  update: (id: number, payload: RoleUpsert) => api.put<Role>(`/Roles/${id}`, payload).then((r) => r.data),
  remove: (id: number) => api.delete(`/Roles/${id}`).then((r) => r.data),
};
