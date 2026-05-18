import { api } from './client';

export interface SessionListItem {
  id: number;
  sessionDate: string;
  startTime: string | null;
  location: string | null;
  notes: string | null;
}

export interface SessionDrill {
  drillId: number;
  drillName: string;
  category: string;
}

export interface SessionDetail {
  id: number;
  sessionDate: string;
  startTime: string | null;
  location: string | null;
  notes: string | null;
  drills: SessionDrill[];
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface SessionUpsert {
  sessionDate: string;
  startTime?: string | null;
  location?: string | null;
  notes?: string | null;
  drillIds?: number[];
}

export const sessionsApi = {
  list: (take?: number) =>
    api.get<SessionListItem[]>('/Sessions', { params: take ? { take } : {} }).then((r) => r.data),
  get: (id: number) => api.get<SessionDetail>(`/Sessions/${id}`).then((r) => r.data),
  create: (data: SessionUpsert) => api.post<SessionDetail>('/Sessions', data).then((r) => r.data),
  update: (id: number, data: SessionUpsert) => api.put<SessionDetail>(`/Sessions/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/Sessions/${id}`).then(() => {}),
};
