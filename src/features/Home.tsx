import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarHeart, CheckSquare, Plus, Search } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarStack, Badge, EmptyState, PageLoader, SectionTitle, Segmented } from '@/components/ui/misc';
import { useAuth } from '@/auth/AuthProvider';
import { useEvents } from '@/data/hooks';
import type { EventListRow } from '@/data/api';
import { supabase } from '@/lib/supabase';
import { countdownLabel, eventState, formatDayShort, formatRange, timeAgo } from '@/domain/time';
import { cn } from '@/lib/utils';
import { brand } from '@/config/brand';

const toneFor = { upcoming: 'neutral', active: 'accent', completed: 'neutral' } as const;
export function EventCard({ e, hero }: { e: EventListRow; hero?: boolean }) {
  const s = eventState(e);
  const { workspaces } = useAuth();
  const family = workspaces.length > 1 ? workspaces.find((w) => w.workspace.id === e.workspace_id)?.workspace.name : undefined;
  return (
    <Link to={`/events/${e.id}`} className="block overflow-hidden rounded-3xl bg-card shadow-soft">
      <div className={cn('relative', hero ? 'h-52' : 'h-32')}><CoverArt scene={e.cover_scene} path={e.cover_path} /><Badge tone={toneFor[s]} className="absolute left-3 top-3 shadow-soft">{countdownLabel(e)}</Badge></div>
      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0"><h3 className={cn('font-display font-semibold leading-tight', hero ? 'text-[25px]' : 'text-xl')}>{e.title}</h3><p className="text-[15px] text-ink-soft">{formatRange(e.start_date, e.end_date)}{e.destination ? `, ${e.destination}` : ''}</p>{family && <p className="text-[15px] font-medium text-teal">{family}</p>}</div>
        <AvatarStack people={e.event_participants.map((p) => ({ name: p.display_name }))} max={3} size={28} />
      </div>
    </Link>
  );
}
function FamilyChips() {
  const { workspaces, familyFilter, setFamilyFilter } = useAuth();
  if (workspaces.length < 2) return null;
  const chip = (on: boolean) => cn('min-h-11 shrink-0 rounded-full px-4 font-semibold', on ? 'bg-ink text-white' : 'bg-card shadow-soft');
  return (
    <div role="group" aria-label="Show events from" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <button aria-pressed={!familyFilter} className={chip(!familyFilter)} onClick={() => setFamilyFilter(null)}>All families</button>
      {workspaces.map((w) => <button key={w.workspace.id} aria-pressed={familyFilter === w.workspace.id} className={chip(familyFilter === w.workspace.id)} onClick={() => setFamilyFilter(w.workspace.id)}>{w.workspace.name}</button>)}
    </div>
  );
}
export function HomePage() {
  const { profile, userId, workspaces, familyFilter } = useAuth();
  const q = useEvents();
  const tasks = useQuery({ queryKey: ['my-tasks', userId], enabled: navigator.onLine, queryFn: async () => (await supabase.from('tasks').select('id,title,due_date,event_id,events(title)').eq('assignee_id', userId).neq('status', 'done').order('due_date', { nullsFirst: false }).limit(5)).data as any[] });
  const recent = useQuery({ queryKey: ['recent', userId], enabled: navigator.onLine, queryFn: async () => (await supabase.from('activity_log').select('id,summary,action,entity_type,created_at,event_id,actor_id,events(title),actor:profiles(display_name,avatar_url)').eq('is_quiet', false).neq('actor_id', userId).order('created_at', { ascending: false }).limit(5)).data as any[] });
  if (q.isLoading) return <PageLoader />;
  const inFamily = (q.data ?? []).filter((e) => !familyFilter || e.workspace_id === familyFilter);
  const all = inFamily.filter((e) => !e.archived_at);
  const active = all.filter((e) => eventState(e) === 'active');
  const upcoming = all.filter((e) => eventState(e) === 'upcoming');
  const lead = active[0] ?? upcoming[0];
  const rest = [...active.slice(1), ...upcoming.filter((e) => e.id !== lead?.id)];
  const first = profile?.display_name?.split(' ')[0];
  const canCreate = workspaces.some((w) => w.role === 'owner' || w.role === 'editor');
  return (
    <div className="pb-nav page-enter mx-auto max-w-6xl px-4 pt-safe lg:p-8">
      <header className="flex items-center justify-between py-4"><h1 className="font-display text-[30px] font-bold">{first ? `Hi, ${first}` : brand.name}</h1><Link to="/search" aria-label="Search" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-soft lg:hidden"><Search className="h-5 w-5" /></Link></header>
      <FamilyChips />
      {!lead ? <EmptyState icon={CalendarHeart} title="Plan your first event" body="Create a trip or gathering, invite your family, and keep every detail in one place.">{canCreate && <Button asChild size="lg"><Link to="/events/new"><Plus className="h-5 w-5" />Create event</Link></Button>}{!canCreate && <Button asChild size="lg"><Link to="/profile">Create your own family</Link></Button>}</EmptyState> : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-5">
            <EventCard e={lead} hero />
            {rest.length > 0 && <section><SectionTitle action={<Link to="/events" className="font-semibold text-teal">All events</Link>}>Coming up</SectionTitle><div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">{rest.slice(0, 4).map((e) => <EventCard key={e.id} e={e} />)}</div></section>}
          </div>
          <div className="mt-5 space-y-5 lg:mt-0">
            {inFamily.length > 0 && <Link to="/events" className="flex min-h-14 items-center justify-between rounded-2xl bg-card px-4 font-semibold shadow-soft">Past and archived events<span className="text-ink-soft">{inFamily.filter((e) => e.archived_at || eventState(e) === 'completed').length}</span></Link>}
            {!!tasks.data?.length && <section><SectionTitle>Your tasks</SectionTitle><ul className="space-y-2">{tasks.data.map((t) => <li key={t.id}><Link to={`/events/${t.event_id}/tasks`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-card p-3 shadow-soft"><CheckSquare className="h-5 w-5 shrink-0 text-teal" aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.title}</span><span className="block truncate text-[15px] text-ink-soft">{t.events?.title}{t.due_date ? `, due ${formatDayShort(t.due_date)}` : ''}</span></span></Link></li>)}</ul></section>}
            {!!recent.data?.length && <section><SectionTitle>Recent updates</SectionTitle><ul className="space-y-3">{recent.data.map((a) => <li key={a.id}><Link to={`/events/${a.event_id}`} className="flex gap-2.5"><Avatar name={a.actor?.display_name} src={a.actor?.avatar_url} size={32} /><span className="min-w-0"><span className="block leading-snug">{a.actor?.display_name || 'Someone'} {a.action} {a.summary ? `“${a.summary}”` : 'something'}</span><span className="text-sm text-ink-soft">{a.events?.title}, {timeAgo(a.created_at)}</span></span></Link></li>)}</ul></section>}
          </div>
        </div>
      )}
    </div>
  );
}
export function EventsPage() {
  const q = useEvents();
  const { familyFilter } = useAuth();
  const [tab, setTab] = React.useState<'upcoming' | 'past' | 'archived'>('upcoming');
  if (q.isLoading) return <PageLoader />;
  if (q.error) return <EmptyState icon={CalendarHeart} title="Events didn't load" body="Check your connection and try again."><Button onClick={() => q.refetch()}>Try again</Button></EmptyState>;
  const all = (q.data ?? []).filter((e) => !familyFilter || e.workspace_id === familyFilter);
  const list = tab === 'archived' ? all.filter((e) => e.archived_at) : tab === 'past' ? all.filter((e) => !e.archived_at && eventState(e) === 'completed').reverse() : all.filter((e) => !e.archived_at && eventState(e) !== 'completed');
  return (
    <div className="pb-nav page-enter mx-auto max-w-5xl px-4 pt-safe lg:p-8">
      <h1 className="py-4 font-display text-[30px] font-bold">Events</h1>
      <FamilyChips />
      <Segmented label="Filter events" value={tab} onChange={setTab} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'archived', label: 'Archived' }]} />
      {list.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{list.map((e) => <EventCard key={e.id} e={e} />)}</div> : <EmptyState icon={CalendarHeart} title={tab === 'upcoming' ? 'No upcoming events' : tab === 'past' ? 'No past events' : 'Nothing archived'} body={tab === 'upcoming' ? 'Create one to get started.' : undefined}>{tab === 'upcoming' && <Button asChild><Link to="/events/new">Create event</Link></Button>}</EmptyState>}
    </div>
  );
}
