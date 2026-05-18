import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  /** 進入此路由群所需的 page 識別碼（對應 Role.AllowedPages） */
  requirePage?: string;
}

export function ProtectedRoute({ requirePage }: Props) {
  const location = useLocation();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const allowed = useAuthStore((s) => (requirePage ? s.canAccess(requirePage) : true));

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (requirePage && !allowed) {
    return <Navigate to="/no-access" replace />;
  }
  return <Outlet />;
}
