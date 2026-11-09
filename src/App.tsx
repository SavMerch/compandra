import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { ConfirmHost } from '@/components/ui/confirm';
import { PageLoader } from '@/components/ui/misc';
import { AppShell } from '@/components/layout/AppShell';
import { AuthCallback, InvitePage, LoginPage, OnboardingPage } from '@/features/account/Auth';
import { NotificationsPage, ProfilePage, SearchPage } from '@/features/account/Account';
import { EventsPage, HomePage } from '@/features/Home';
import { NewEventPage } from '@/features/NewEvent';
import { EventLayout } from '@/features/event/EventLayout';
import { OverviewPage } from '@/features/event/Overview';
import { AgendaPage } from '@/features/event/Agenda';
import { TodayPage } from '@/features/event/Today';
import { ParticipantsPage } from '@/features/event/People';
import { SettingsPage } from '@/features/event/Settings';
import { CompetitionPage, PassesPage, StayPage, TravelPage } from '@/features/modules/Domain';
import { PackingPage } from '@/features/modules/Packing';
import { NotesPage, TasksPage } from '@/features/modules/TasksNotes';
import { DocumentsPage } from '@/features/modules/Documents';

function RequireAuth() {
  const { session, loading, workspace, workspacesLoading } = useAuth();
  const { pathname } = useLocation();
  if (loading || workspacesLoading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!workspace && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
export default function App() {
  return <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<NewEventPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/events/:eventId" element={<EventLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="passes" element={<PassesPage />} />
            <Route path="travel" element={<TravelPage />} />
            <Route path="stay" element={<StayPage />} />
            <Route path="competition" element={<CompetitionPage />} />
            <Route path="packing" element={<PackingPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <ConfirmHost />
    <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontSize: 16 } }} offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} />
  </>;
}
