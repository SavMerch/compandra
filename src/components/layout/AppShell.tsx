import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, CalendarRange, CirclePlus, Home, Search, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useNotificationsRealtime } from '@/realtime/useRealtime';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { CompanyLogo } from '@/components/CompanyLogo';
import { SyncBanner, useOnlineWatcher } from './SyncStatus';

export function useUnreadCount() {
  const { userId } = useAuth();
  return useQuery({ queryKey: ['notifications', userId, 'unread'], enabled: !!userId && navigator.onLine, queryFn: async () => {
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    return count ?? 0;
  } }).data ?? 0;
}
const items = [
  { to: '/', label: 'Home', icon: Home, end: true }, { to: '/events', label: 'Events', icon: CalendarRange },
  { to: '/events/new', label: 'Create', icon: CirclePlus }, { to: '/notifications', label: 'Alerts', icon: Bell }, { to: '/profile', label: 'Profile', icon: UserRound },
];
export function AppShell() {
  const { userId, profile } = useAuth();
  const { pathname } = useLocation();
  useNotificationsRealtime(userId); useOnlineWatcher();
  const unread = useUnreadCount();
  const inEvent = /^\/events\/(?!new)[^/]+/.test(pathname);
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-card px-4 py-6 lg:flex">
        <div className="mb-7 px-3 font-display text-[26px] font-bold">{brand.name}</div>
        <nav aria-label="Main" className="space-y-1">
          {[...items.slice(0, 2), { to: '/search', label: 'Search', icon: Search }, ...items.slice(3)].map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end || i.to === '/events'} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium', isActive ? 'bg-teal-soft text-teal' : 'text-ink hover:bg-sand')}>
              <i.icon className="h-5 w-5" aria-hidden />{i.label === 'Alerts' ? 'Notifications' : i.label}
              {i.to === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-accent px-2 text-xs font-bold text-white">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/events/new" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal font-semibold text-white"><CirclePlus className="h-5 w-5" aria-hidden />Create event</NavLink>
        <CompanyLogo className="mx-2 mt-auto" />
        <div className="mt-4 flex items-center gap-3 px-2"><Avatar name={profile?.display_name} src={profile?.avatar_url} /><span className="truncate font-medium">{profile?.display_name}</span></div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30"><SyncBanner /></div>
        <Outlet />
      </div>
      {!inEvent && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-safe backdrop-blur lg:hidden">
          <div className="grid h-[4.5rem] grid-cols-5">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end || i.to === '/events'} aria-label={i.label} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold', isActive ? 'text-teal' : 'text-ink-soft')}>
                {i.to === '/events/new' ? <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-soft"><i.icon className="h-6 w-6" aria-hidden /></span> : <><i.icon className="h-6 w-6" aria-hidden />{i.label}</>}
                {i.to === '/notifications' && unread > 0 && <span className="absolute right-[26%] top-3 h-2.5 w-2.5 rounded-full bg-accent" aria-label={`${unread} unread`} />}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
