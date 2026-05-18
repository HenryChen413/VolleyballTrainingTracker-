import { api } from './client';

export interface Overview {
  activePlayerCount: number;
  lastSessionDate: string | null;
  latestAcademicYear: number | null;
  officialEventCount: number;
  friendlyEventCount: number;
}

export interface DrillBreakdown {
  name: string;
  count: number;
}

export interface CategoryItem {
  key: string;
  label: string;
  count: number;
  percent: number;
  drills: DrillBreakdown[];
}

export interface CategoryDistribution {
  total: number;
  categories: CategoryItem[];
  basicCount: number;
  fitnessCount: number;
}

export interface MatchResultLine {
  opponent: string;
  ourSquad: string | null;
  ourScore: number | null;
  opponentScore: number | null;
  result: string | null;
}

export interface MatchEvent {
  matchDate: string;
  matchName: string | null;
  ranking: string | null;
  rankingB: string | null;
  location: string | null;
  squadCount: number;
  lines: MatchResultLine[];
}

export interface MatchSummary {
  academicYear: number | null;
  eventCount: number;
  wins: number;
  losses: number;
  draws: number;
  events: MatchEvent[];
}

export interface RecentEvent {
  matchDate: string;
  matchType: string | null;
  matchName: string | null;
  ranking: string | null;
  location: string | null;
  squadCount: number;
}

export const statsApi = {
  overview: () => api.get<Overview>('/Stats/overview').then((r) => r.data),
  categoryDistribution: (months = 6) =>
    api.get<CategoryDistribution>('/Stats/category-distribution', { params: { months } }).then((r) => r.data),
  matchSummary: (academicYear?: number) =>
    api
      .get<MatchSummary>('/Stats/match-summary', { params: academicYear != null ? { academicYear } : {} })
      .then((r) => r.data),
  recentEvents: (take = 5) =>
    api.get<RecentEvent[]>('/Stats/recent-events', { params: { take } }).then((r) => r.data),
};
