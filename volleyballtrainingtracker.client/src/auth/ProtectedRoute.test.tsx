import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore, type AuthUser } from '@/stores/authStore';

function login(overrides: Partial<AuthUser> = {}) {
  const future = new Date(Date.now() + 60_000).toISOString();
  useAuthStore.getState().setAuth('tok', future, {
    id: 1,
    userName: 'TESTER',
    email: 'tester@example.com',
    roleId: 2,
    role: 'Coach',
    permissions: [],
    allowedPages: ['players'],
    ...overrides,
  });
}

function renderAt(path: string, requirePage?: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute requirePage={requirePage} />}>
          <Route path="/players" element={<div>球員頁面</div>} />
        </Route>
        <Route path="/login" element={<div>登入頁</div>} />
        <Route path="/no-access" element={<div>無權限</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('未登入時導向登入頁', () => {
    renderAt('/players');
    expect(screen.getByText('登入頁')).toBeInTheDocument();
  });

  it('已登入且有頁面權限時顯示內容', () => {
    login({ allowedPages: ['players'] });
    renderAt('/players', 'players');
    expect(screen.getByText('球員頁面')).toBeInTheDocument();
  });

  it('已登入但無該頁權限時導向無權限頁', () => {
    login({ allowedPages: ['dashboard'] });
    renderAt('/players', 'players');
    expect(screen.getByText('無權限')).toBeInTheDocument();
  });

  it('未指定 requirePage 時僅需登入即可進入', () => {
    login({ allowedPages: [] });
    renderAt('/players');
    expect(screen.getByText('球員頁面')).toBeInTheDocument();
  });
});
