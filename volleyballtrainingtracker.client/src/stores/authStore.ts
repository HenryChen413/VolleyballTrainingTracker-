import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  userName: string;
  email: string;
  roleId: number;
  role: string;
  displayName?: string | null;
  permissions: string[];
  allowedPages: string[];
}

interface AuthState {
  accessToken: string | null;
  expiresAt: string | null;
  user: AuthUser | null;
  setAuth: (token: string, expiresAt: string, user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
  /** 是否擁有某項權限（會改 DB 的動作） */
  can: (permission: string) => boolean;
  /** 是否可進入某個頁面 */
  canAccess: (page: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      expiresAt: null,
      user: null,
      setAuth: (accessToken, expiresAt, user) => set({ accessToken, expiresAt, user }),
      updateUser: (patch) => {
        const cur = get().user;
        if (cur) set({ user: { ...cur, ...patch } });
      },
      clear: () => set({ accessToken: null, expiresAt: null, user: null }),
      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken || !expiresAt) return false;
        return new Date(expiresAt).getTime() > Date.now();
      },
      can: (permission) => !!get().user?.permissions?.includes(permission),
      canAccess: (page) => !!get().user?.allowedPages?.includes(page),
    }),
    { name: 'vbtt-auth' }
  )
);

/** 集中管理權限字串，避免散落 magic string */
export const PERM = {
  PlayersEdit: 'players.edit',
  PlayersPurge: 'players.purge',
  SessionsEdit: 'sessions.edit',
  DrillsEdit: 'drills.edit',
  MatchLogsEdit: 'matchlogs.edit',
  UsersManage: 'users.manage',
  RolesManage: 'roles.manage',
} as const;

export const PAGE = {
  Dashboard: 'dashboard',
  Players: 'players',
  Sessions: 'sessions',
  MatchLogs: 'match-logs',
  Drills: 'drills',
  AdminRoles: 'admin-roles',
  AdminUsers: 'admin-users',
  Profile: 'profile',
} as const;
