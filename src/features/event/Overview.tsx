import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Car, CalendarPlus, CheckSquare, Compass, Luggage, Plane, Upload, UserPlus } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarStack, Badge, Card, Progress, SectionTitle } from '@/components/ui/misc';
import { countdownLabel, daysBetween, formatDayShort, formatLocalStamp, formatRange, formatTime, timeAgo } from '@/domain/time';
import { currentAndNext, sortItems } from '@/domain/schedule';
import { packingProgress } from '@/domain/packing';
import type { ActivityEntry } from '@/domain/types';
import { useEvent } from './EventContext';
import { ActivityRow } from './ActivityRow';
import { NowNext } from './Today';

export function describeActivity(a: ActivityEntry, who: string) {
  const name = a.summary ? `“${a.summary}”` : 'an item';
  if (a.entity_type === 'event') return a.action === 'created' ? `${who} created this event` : `${who} updated the event details`;
  if (a.entity_type === 'participant') return `${who} ${a.action === 'deleted' ? 'removed' : a.action === 'created' ? 'added' : 'updated'} ${a.summary ?? 'someone'}`;
  if (a.entity_type === 'travel') return `${who} ${a.action} a travel booking`;
  return `${who} ${a.action === 'created' ? 'added' : a.action} ${name}`;
}

export function OverviewPage() {
  const { b, state, today, nowTime, personName, canEdit, mode, setMode, addActivity, openMore } = useEvent();
  const e = b.event, base = `/events/${e.id}`;
  const dayMap = new Map(b.days.map((d) => [d.id, d.day_date]));
  const todayDay = b.days.find((d) => d.day_date === today);
  const todays = todayDay ? b.items.filter((i) => i.event_day_id === todayDay.id) : [];
  const nn = currentAndNext(todays, nowTime);
  const upcoming = sortItems(b.items.filter((i) => { const d = i.event_day_id && dayMap.get(i.event_day_id); return d && d >= today && i.status !== 'cancelled' && (d > today || !i.start_time || i.start_time.slice(0, 5) >= nowTime); }))
    .sort((x, y) => dayMap.get(x.event_day_id!)!.localeCompare(dayMap.get(y.event_day_id!)!)).slice(0, 4);
  const pack = packingProgress(b.packing);
  const open = b.tasks.filter((t) => t.status !== 'done');
  const total = daysBetween(e.start_date, e.end_date) + 1;
  const elapsed = state === 'active' ? daysBetween(e.start_date, today) + 1 : 0;
  const quick = [
    canEdit && { label: 'Add activity', icon: CalendarPlus, on: () => addActivity() },
    canEdit && { label: 'Add task', icon: CheckSquare, to: `${base}/tasks?new=1` },
    canEdit && { label: 'Upload', icon: Upload, to: `${base}/documents?upload=1` },
    canEdit && { label: 'Invite', icon: UserPlus, to: `${base}/participants` },
  ].filter(Boolean) as { label: string; icon: typeof Plane; on?: () => void; to?: string }[];
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:p-6">
      <div>
        <div className="relative h-56 overflow-hidden lg:h-72 lg:rounded-3xl">
          <CoverArt scene={e.cover_scene} path={e.cover_path} alt="" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent p-4 pt-14 text-white">
            <Badge className="mb-1.5 bg-white text-ink">{countdownLabel(e)}</Badge>
            <h2 className="font-display text-[30px] font-bold leading-tight">{e.title}</h2>
            <p className="text-[16px]">{formatRange(e.start_date, e.end_date)}{e.destination ? `, ${e.destination}` : ''}</p>
          </div>
        </div>
        <div className="space-y-6 p-4 lg:px-0">
          <div className="flex items-center justify-between">
            <Link to={`${base}/participants`} aria-label="See people"><AvatarStack people={b.participants.map((p) => ({ name: p.display_name, src: b.profiles.find((x) => x.id === p.user_id)?.avatar_url }))} max={5} size={36} /></Link>
            {state === 'active' && <div className="w-32"><Progress value={Math.round((elapsed / total) * 100)} label="Event progress" /></div>}
          </div>
          {state === 'active' && mode === 'plan' && <Card className="flex items-center justify-between gap-3 bg-ink p-4 text-white"><div><div className="font-display text-lg font-semibold">It's happening today</div><p className="text-white/80">Go Mode shows just what you need now.</p></div><Button asChild variant="soft" onClick={() => setMode('go')}><Link to={`${base}/today`}>Open Go</Link></Button></Card>}
          {state === 'active' && <NowNext {...nn} />}
          {state === 'completed' && <Card className="p-4"><div className="font-display text-lg font-semibold">This event is over</div><p className="text-ink-soft">Everything stays here. You can reuse it from Settings.</p><Button asChild variant="soft" className="mt-3"><Link to={`${base}/settings`}>Duplicate or archive</Link></Button></Card>}
          {quick.length > 0 && <div className="grid grid-cols-4 gap-2">{quick.map((q) => { const inner = <><q.icon className="h-5 w-5 text-teal" aria-hidden /><span className="text-[13px] font-semibold">{q.label}</span></>; const c = 'flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-card shadow-soft'; return q.to ? <Link key={q.label} to={q.to} className={c}>{inner}</Link> : <button key={q.label} onClick={q.on} className={c}>{inner}</button>; })}</div>}
          <section><SectionTitle action={<Link to={`${base}/agenda`} className="flex items-center gap-1 font-semibold text-teal">Agenda<ArrowRight className="h-4 w-4" aria-hidden /></Link>}>Coming up</SectionTitle>
            {upcoming.length ? <div className="space-y-2">{upcoming.map((i) => <div key={i.id}><div className="mb-0.5 text-[14px] font-semibold text-ink-soft">{formatDayShort(dayMap.get(i.event_day_id!)!)}{i.start_time ? `, ${formatTime(i.start_time)}` : ''}</div><ActivityRow item={i} /></div>)}</div> : <Card className="p-4 text-ink-soft">No upcoming activities. {canEdit && <button onClick={() => addActivity()} className="font-semibold text-teal">Add one</button>}</Card>}
          </section>
        </div>
      </div>
      <div className="space-y-6 px-4 lg:px-0">
        {(b.travel.length > 0 || b.stays.length > 0) && <section><SectionTitle>Reservations</SectionTitle><div className="space-y-2">
          {b.travel.slice(0, 3).map((t) => <Link key={t.id} to={`${base}/travel`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft">{t.mode === 'flight' ? <Plane className="h-5 w-5 shrink-0 text-teal" aria-hidden /> : <Car className="h-5 w-5 shrink-0 text-teal" aria-hidden />}<span className="min-w-0"><span className="block truncate font-semibold">{[t.carrier, t.flight_number].filter(Boolean).join(' ') || 'Transportation'}</span><span className="text-[15px] text-ink-soft">{formatLocalStamp(t.depart_local)}</span></span></Link>)}
          {b.stays.slice(0, 2).map((s) => <Link key={s.id} to={`${base}/stay`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft"><BedDouble className="h-5 w-5 shrink-0 text-teal" aria-hidden /><span className="min-w-0"><span className="block truncate font-semibold">{s.name}</span><span className="text-[15px] text-ink-soft">{formatLocalStamp(s.check_in_local)}</span></span></Link>)}
        </div></section>}
        <section className="grid grid-cols-2 gap-2.5">
          <Link to={`${base}/packing`} className="rounded-2xl bg-card p-4 shadow-soft"><Luggage className="mb-2 h-5 w-5 text-teal" aria-hidden /><div className="font-display text-2xl font-semibold">{pack.pct}%</div><div className="mb-2 text-[15px] text-ink-soft">{pack.done} of {pack.total} packed</div><Progress value={pack.pct} label="Packing progress" /></Link>
          <Link to={`${base}/tasks`} className="rounded-2xl bg-card p-4 shadow-soft"><CheckSquare className="mb-2 h-5 w-5 text-teal" aria-hidden /><div className="font-display text-2xl font-semibold">{open.length}</div><div className="text-[15px] text-ink-soft">task{open.length === 1 ? '' : 's'} left</div></Link>
        </section>
        {b.activity.length > 0 && <section><SectionTitle>Recent updates</SectionTitle><ul className="space-y-3">{b.activity.slice(0, 6).map((a) => <li key={a.id} className="flex gap-2.5"><Avatar name={b.profiles.find((p) => p.id === a.actor_id)?.display_name} src={b.profiles.find((p) => p.id === a.actor_id)?.avatar_url} size={30} /><div className="min-w-0"><p className="leading-snug">{describeActivity(a, personName(a.actor_id))}</p><p className="text-sm text-ink-soft">{timeAgo(a.created_at)}</p></div></li>)}</ul></section>}
        {!b.travel.length && !b.stays.length && canEdit && <button onClick={openMore} className="flex w-full items-center gap-2 font-semibold text-teal"><Compass className="h-5 w-5" aria-hidden />Browse all sections</button>}
      </div>
    </div>
  );
}
