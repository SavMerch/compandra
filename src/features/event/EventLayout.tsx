import * as React from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Ellipsis, Plus, Search, Settings, Ticket, LayoutDashboard, Compass, ClipboardList, CheckSquare, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { useEventRealtime } from '@/realtime/useRealtime';
import { Button } from '@/components/ui/button';
import { EmptyState, PageLoader, Segmented, Input, Field } from '@/components/ui/misc';
import { Sheet, useIsDesktop } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { friendlyError, insertRow } from '@/data/api';
import { MODULES, MODULE_ORDER } from './modules';
import { EventCtxProvider, useEventBase, type EventCtx } from './EventContext';
import { ActivityDetailSheet, ActivityFormSheet } from './ActivitySheets';
import type { ItineraryItem, ModuleKey } from '@/domain/types';
import { formatTime } from '@/domain/time';

function useReminders(ctx: EventCtx | null) {
  // Reminders are in-app only and fire only while the app is open.
  React.useEffect(() => {
    if (!ctx || ctx.state !== 'active') return;
    const day = ctx.b.days.find((d) => d.day_date === ctx.today);
    if (!day) return;
    const [h, m] = ctx.nowTime.split(':').map(Number); const now = h * 60 + m;
    for (const i of ctx.b.items) {
      if (i.event_day_id !== day.id || i.reminder_minutes == null || !i.start_time || i.status === 'completed') continue;
      const [ih, im] = i.start_time.split(':').map(Number); const at = ih * 60 + im;
      const key = `rem-${i.id}-${ctx.today}`;
      if (now >= at - i.reminder_minutes && now < at && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        toast(`Coming up: ${i.title}`, { description: formatTime(i.start_time), duration: 15000 });
      }
    }
  }, [ctx?.nowTime, ctx?.b, ctx?.state, ctx?.today]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function EventLayout() {
  const { eventId = '' } = useParams();
  useEventRealtime(eventId);
  const { q, run, userId, mode, setMode, derived } = useEventBase(eventId);
  const [itemId, setItemId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ item?: ItineraryItem; defaults?: Partial<ItineraryItem> } | null>(null);
  const [more, setMore] = React.useState(false);
  const [quick, setQuick] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const desktop = useIsDesktop();
  const ctx: EventCtx | null = q.data && derived ? {
    b: q.data, ...derived, mode, setMode, run, userId, openItem: setItemId, addActivity: (defaults) => setForm({ defaults }),
    editItem: (item) => { setItemId(null); setForm({ item }); }, quickAdd: () => setQuick(true), openMore: () => setMore(true),
  } : null;
  useReminders(ctx);
  // Entering Go Mode lands on Today; leaving returns to Overview.
  const switchMode = (m: 'plan' | 'go') => { setMode(m); nav(`/events/${eventId}${m === 'go' ? '/today' : ''}`); };

  if (q.isLoading) return <PageLoader />;
  if (q.error || !ctx) return <EmptyState icon={Compass} title="This event isn't available" body="It may have been deleted, or you may not have access. If you're offline, open it once online first."><Button asChild><Link to="/">Go home</Link></Button></EmptyState>;
  const { event } = ctx.b;
  const base = `/events/${eventId}`;
  const mods = MODULE_ORDER.filter((k) => event.modules.includes(k) || !MODULES[k].optional);
  const pinned = (event.pinned_modules.filter((k) => mods.includes(k)).slice(0, 3)) as ModuleKey[];
  const tabs = mode === 'go'
    ? [{ to: `${base}/today`, label: 'Today', icon: CalendarCheck }, { to: `${base}/agenda`, label: 'Agenda', icon: ClipboardList }, { to: `${base}/passes`, label: 'Passes', icon: Ticket }, { to: `${base}/tasks`, label: 'Tasks', icon: CheckSquare }]
    : [{ to: base, label: 'Overview', icon: LayoutDashboard, end: true }, ...pinned.map((k) => ({ to: `${base}/${MODULES[k].path}`, label: MODULES[k].label, icon: MODULES[k].icon }))];
  const showFab = ctx.canEdit && !/\/(settings|participants)$/.test(pathname);
  const desktopTabs = [{ to: base, label: 'Overview', end: true }, { to: `${base}/today`, label: 'Today' }, ...mods.map((k) => ({ to: `${base}/${MODULES[k].path}`, label: MODULES[k].label })), { to: `${base}/passes`, label: 'Passes' }];

  return (
    <EventCtxProvider.Provider value={ctx}>
      <header style={{ top: 'var(--banner-h, 0px)' }} className="sticky z-20 border-b border-line bg-paper/95 pt-safe backdrop-blur">
        <div className="flex items-center gap-2 px-2 py-1.5 lg:px-6">
          <Link to="/" aria-label="Back to home" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-sand"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-[19px] font-semibold">{event.title}</h1>
          <div className="w-32 shrink-0"><Segmented label="Mode" value={mode} onChange={switchMode} options={[{ value: 'plan', label: 'Plan' }, { value: 'go', label: 'Go' }]} /></div>
          <Link to={`/search?event=${eventId}`} aria-label="Search this event" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-sand"><Search className="h-5 w-5" /></Link>
          {desktop && <Link to={`${base}/settings`} aria-label="Event settings" className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand"><Settings className="h-5 w-5" /></Link>}
        </div>
        {desktop && <nav aria-label="Event sections" className="no-scrollbar flex gap-1 overflow-x-auto px-6 pb-2">
          {desktopTabs.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('rounded-xl px-3.5 py-2 text-[15px] font-semibold', isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sand')}>{t.label}</NavLink>)}
        </nav>}
      </header>
      {ctx.b.fromCache && <p role="status" className="bg-gold-soft px-4 py-1.5 text-center text-sm font-medium text-gold">Showing the last saved copy</p>}
      <main key={pathname} className="page-enter pb-nav mx-auto max-w-[1400px] lg:pb-10"><Outlet /></main>

      {showFab && <button aria-label="Quick add" onClick={() => setQuick(true)} className="bottom-nav-offset fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lift active:scale-95 lg:bottom-8 lg:right-8"><Plus className="h-7 w-7" /></button>}

      <nav aria-label="Event" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-safe backdrop-blur lg:hidden">
        <div className="grid h-[4.5rem]" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)` }}>
          {tabs.map((t) => <NavLink key={t.to} to={t.to} end={(t as { end?: boolean }).end} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold', isActive ? 'text-teal' : 'text-ink-soft')}><t.icon className="h-6 w-6" aria-hidden />{t.label}</NavLink>)}
          <button onClick={() => setMore(true)} className="flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold text-ink-soft"><Ellipsis className="h-6 w-6" aria-hidden />More</button>
        </div>
      </nav>

      <Sheet open={more} onOpenChange={setMore} title="Event sections">
        <div className="grid grid-cols-3 gap-2.5 pb-3">
          {[{ to: base, label: 'Overview', icon: LayoutDashboard }, { to: `${base}/today`, label: 'Today', icon: CalendarCheck }, { to: `${base}/passes`, label: 'Passes', icon: Ticket },
            ...mods.map((k) => ({ to: `${base}/${MODULES[k].path}`, label: MODULES[k].label, icon: MODULES[k].icon })), { to: `${base}/settings`, label: 'Settings', icon: Settings }].map((m) => (
            <Link key={m.to} to={m.to} onClick={() => setMore(false)} className="flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-card text-[14px] font-semibold shadow-soft"><m.icon className="h-6 w-6 text-teal" aria-hidden />{m.label}</Link>
          ))}
        </div>
      </Sheet>

      <Sheet open={quick} onOpenChange={setQuick} title="Add">
        <div className="space-y-2 pb-3">
          <Button size="lg" className="w-full justify-start" onClick={() => { setQuick(false); const d = ctx.b.days.find((x) => x.day_date === ctx.today) ?? ctx.b.days[0]; setForm({ defaults: { event_day_id: d?.id } }); }}><CalendarCheck className="h-5 w-5" />Activity</Button>
          <Button size="lg" variant="soft" className="w-full justify-start" onClick={() => { setQuick(false); setForm({ defaults: { event_day_id: null } }); }}><Compass className="h-5 w-5" />Idea for later</Button>
          <Button size="lg" variant="soft" className="w-full justify-start" onClick={() => { setQuick(false); setNoteOpen(true); }}><NotebookPen className="h-5 w-5" />Note</Button>
          <Button size="lg" variant="soft" className="w-full justify-start" onClick={() => { setQuick(false); nav(`${base}/tasks?new=1`); }}><CheckSquare className="h-5 w-5" />Task</Button>
          <Button size="lg" variant="soft" className="w-full justify-start" onClick={() => { setQuick(false); nav(`${base}/documents?upload=1`); }}><Plus className="h-5 w-5" />Document</Button>
        </div>
      </Sheet>
      <QuickNote open={noteOpen} onClose={() => setNoteOpen(false)} eventId={eventId} run={run} />
      {itemId && <ActivityDetailSheet itemId={itemId} onClose={() => setItemId(null)} />}
      {form && <ActivityFormSheet item={form.item} defaults={form.defaults} onClose={() => setForm(null)} />}
    </EventCtxProvider.Provider>
  );
}
function QuickNote({ open, onClose, eventId, run }: { open: boolean; onClose: () => void; eventId: string; run: EventCtx['run'] }) {
  const [body, setBody] = React.useState('');
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Quick note">
      <form className="space-y-3 pb-3" onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return toast.error(friendlyError(new Error('Write something first.')));
        const ok = await run(() => insertRow('notes', { event_id: eventId, body: body.trim(), title: body.trim().slice(0, 40) }), 'Note added'); if (ok) { setBody(''); onClose(); } }}>
        <Field label="Note" htmlFor="qn"><Input id="qn" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Parking is on level 3" /></Field>
        <Button type="submit" className="w-full" size="lg">Add note</Button>
      </form>
    </Sheet>
  );
}
