import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, type AuthUser } from './authStore';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    userName: 'TESTER',
    email: 'tester@example.com',
    roleId: 2,
    role: 'Coach',
    permissions: ['players.edit', 'sessions.edit'],
    allowedPages: ['dashboard', 'players'],
    ...overrides,
  };
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  describe('isAuthenticated', () => {
    it('無 token 時為 false', () => {
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    it('token 未過期時為 true', () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      useAuthStore.getState().setAuth('tok', future, makeUser());
      expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    });

    it('token 已過期時為 false', () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      useAuthStore.getState().setAuth('tok', past, makeUser());
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });
  });

  describe('can（動作權限）', () => {
    it('擁有的權限回傳 true', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      expect(useAuthStore.getState().can('players.edit')).toBe(true);
    });

    it('未擁有的權限回傳 false', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      expect(useAuthStore.getState().can('users.manage')).toBe(false);
    });

    it('未登入時回傳 false', () => {
      expect(useAuthStore.getState().can('players.edit')).toBe(false);
    });
  });

  describe('canAccess（頁面權限）', () => {
    it('允許的頁面回傳 true', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      expect(useAuthStore.getState().canAccess('players')).toBe(true);
    });

    it('未允許的頁面回傳 false', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      expect(useAuthStore.getState().canAccess('admin-users')).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('部分更新會合併進現有 user', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      useAuthStore.getState().updateUser({ displayName: '新名字' });
      const u = useAuthStore.getState().user;
      expect(u?.displayName).toBe('新名字');
      expect(u?.userName).toBe('TESTER');
    });

    it('未登入時不會建立 user', () => {
      useAuthStore.getState().updateUser({ displayName: '新名字' });
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('clear', () => {
    it('清除 token 與 user', () => {
      useAuthStore.getState().setAuth('tok', '', makeUser());
      useAuthStore.getState().clear();
      const s = useAuthStore.getState();
      expect(s.accessToken).toBeNull();
      expect(s.user).toBeNull();
    });
  });
});
