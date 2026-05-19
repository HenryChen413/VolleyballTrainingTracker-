import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { Toaster } from '@/components/Toaster';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import CalendarPage from '@/pages/Calendar';
import PlayersPage from '@/pages/Players';
import PlayerEditPage from '@/pages/PlayerEdit';
import SessionsPage from '@/pages/Sessions';
import SessionEditPage from '@/pages/SessionEdit';
import MatchLogsPage from '@/pages/MatchLogs';
import MatchLogEditPage from '@/pages/MatchLogEdit';
import DrillsPage from '@/pages/Drills';
import DrillEditPage from '@/pages/DrillEdit';
import ProfilePage from '@/pages/Profile';
import AdminRolesPage from '@/pages/AdminRoles';
import AdminUsersPage from '@/pages/AdminUsers';
import NoAccessPage from '@/pages/NoAccess';
import { PAGE } from '@/stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/no-access" element={<NoAccessPage />} />

              <Route element={<ProtectedRoute requirePage={PAGE.Dashboard} />}>
                <Route path="/" element={<DashboardPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Calendar} />}>
                <Route path="/calendar" element={<CalendarPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Players} />}>
                <Route path="/players" element={<PlayersPage />} />
                <Route path="/players/:id" element={<PlayerEditPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Sessions} />}>
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/sessions/:id" element={<SessionEditPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.MatchLogs} />}>
                <Route path="/match-logs" element={<MatchLogsPage />} />
                <Route path="/match-logs/:id" element={<MatchLogEditPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Drills} />}>
                <Route path="/drills" element={<DrillsPage />} />
                <Route path="/drills/:id" element={<DrillEditPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Profile} />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.AdminRoles} />}>
                <Route path="/admin/roles" element={<AdminRolesPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.AdminUsers} />}>
                <Route path="/admin/users" element={<AdminUsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
