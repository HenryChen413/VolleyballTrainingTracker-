import { api } from './client';

export interface Drill {
  id: number;
  name: string;
  category: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface DrillUpsert {
  name: string;
  category: string;
  description?: string | null;
  isActive: boolean;
}

export const drillsApi = {
  list: (activeOnly = true) =>
    api.get<Drill[]>('/Drills', { params: { activeOnly } }).then((r) => r.data),
  get: (id: number) => api.get<Drill>(`/Drills/${id}`).then((r) => r.data),
  create: (data: DrillUpsert) => api.post<Drill>('/Drills', data).then((r) => r.data),
  update: (id: number, data: DrillUpsert) => api.put<Drill>(`/Drills/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/Drills/${id}`).then(() => {}),
};
