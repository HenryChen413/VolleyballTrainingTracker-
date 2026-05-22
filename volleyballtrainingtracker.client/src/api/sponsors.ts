import { api } from './client';

/** 贊助者身分代碼 → 中文（0=學姊 1=學長 2=家長 3=廠商 4=其他） */
export const SPONSOR_IDENTITY = {
  Senior: 0, // 學姊
  SeniorMale: 1, // 學長
  Parent: 2, // 家長
  Vendor: 3, // 廠商
  Other: 4, // 其他
} as const;

export const SPONSOR_IDENTITY_LABEL: Record<number, string> = {
  0: '學姊',
  1: '學長',
  2: '家長',
  3: '廠商',
  4: '其他',
};

/** 表單下拉用：依代碼順序 */
export const SPONSOR_IDENTITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '學姊' },
  { value: 1, label: '學長' },
  { value: 2, label: '家長' },
  { value: 3, label: '廠商' },
  { value: 4, label: '其他' },
];

export interface Sponsor {
  id: number;
  playerId: number | null;
  displayName: string;
  identity: number;
  notes: string | null;
  jerseyNo: number | null;
  totalAmount: number;
  count: number;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface SponsorUpsert {
  playerId?: number | null;
  displayName: string;
  identity: number;
  notes?: string | null;
}

export interface Sponsorship {
  id: number;
  sponsorId: number;
  sponsorName: string;
  sponsorIdentity: number;
  sponsorJerseyNo: number | null;
  amount: number;
  occurredAt: string; // YYYY-MM-DD
  purpose: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface SponsorshipUpsert {
  sponsorId: number;
  amount: number;
  occurredAt: string;
  purpose?: string | null;
  notes?: string | null;
}

export interface SponsorRank {
  sponsorId: number;
  displayName: string;
  identity: number;
  jerseyNo: number | null;
  totalAmount: number;
  count: number;
}

export interface SponsorStats {
  totalAmount: number;
  totalCount: number;
  sponsorCount: number;
  topSponsors: SponsorRank[];
  recentPurposes: string[];
}

export interface SponsorshipListQuery {
  sponsorId?: number;
  from?: string;
  to?: string;
}

export const sponsorsApi = {
  // 贊助者名冊
  listSponsors: () => api.get<Sponsor[]>('/sponsors').then((r) => r.data),
  getSponsor: (id: number) => api.get<Sponsor>(`/sponsors/${id}`).then((r) => r.data),
  createSponsor: (data: SponsorUpsert) =>
    api.post<Sponsor>('/sponsors', data).then((r) => r.data),
  updateSponsor: (id: number, data: SponsorUpsert) =>
    api.put<Sponsor>(`/sponsors/${id}`, data).then((r) => r.data),
  removeSponsor: (id: number) => api.delete(`/sponsors/${id}`).then(() => {}),

  // 贊助紀錄
  listSponsorships: (q: SponsorshipListQuery = {}) =>
    api.get<Sponsorship[]>('/sponsors/sponsorships', { params: q }).then((r) => r.data),
  createSponsorship: (data: SponsorshipUpsert) =>
    api.post<Sponsorship>('/sponsors/sponsorships', data).then((r) => r.data),
  updateSponsorship: (id: number, data: SponsorshipUpsert) =>
    api.put<Sponsorship>(`/sponsors/sponsorships/${id}`, data).then((r) => r.data),
  removeSponsorship: (id: number) =>
    api.delete(`/sponsors/sponsorships/${id}`).then(() => {}),

  // 統計
  stats: (q: { from?: string; to?: string; top?: number } = {}) =>
    api.get<SponsorStats>('/sponsors/stats', { params: q }).then((r) => r.data),
};
