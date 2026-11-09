import { Link } from 'react-router-dom';
import { CalendarCheck, Check, Navigation, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionTitle } from '@/components/ui/misc';
import { formatDayLong, formatTime } from '@/domain/time';
import { currentAndNext, sortItems } from '@/domain/schedule';
import { openMaps } from '@/lib/platform';
import { saveVersioned } from '@/data/api';
import type { ItineraryItem } from '@/domain/types';
import { useEvent } from './EventContext';
import { DayTimeline } from './Agenda';

function Stub({ item, label, live }: { item: ItineraryItem; label: string; live?: boolean }) {
  const { openItem, peopleOf, canEdit, run } = useEvent();
  const who = peopleOf(item.id);
  const place = item.address || item.location_name;
  return (
    <div className="p-4">
      <button className="block w-full text-left" onClick={() => openItem(item.id)}>
        <div className={live ? 'font-semibold text-accent' : 'font-semibold text-ink-soft'}>{label}{item.start_time ? `, ${formatTime(item.start_time)}` : ''}{item.end_time ? ` to ${formatTime(item.end_time)}` : ''}</div>
        <div className="mt-0.5 font-display text-[26px] font-semibold leading-tight">{item.title}</div>
        {item.location_name && <div className="mt-1 text-ink-soft">{item.location_name}</div>}
        {who.length > 0 && <div className="text-ink-soft">With {who.join(', ')}</div>}
        {item.confirmation_number && <div className="mt-1 font-semibold">Confirmation {item.confirmation_number}</div>}
      </button>
      {(place || (live && canEdit)) && <div className="mt-3 flex gap-2">
        {place && <Button size="sm" onClick={() => openMaps(place)}><Navigation className="h-4 w-4" />Open in Maps</Button>}
        {live && canEdit && <Button size="sm" variant="soft" onClick={() => run(() => saveVersioned('itinerary_items', item, { status: 'completed' }).then(() => true), 'Marked complete')}><Check className="h-4 w-4" />Done</Button>}
      </div>}
    </div>
  );
}
/** The ticket: what's on now, torn from what's next. */
export function NowNext({ current, next }: { current: ItineraryItem | null; next: ItineraryItem | null }) {
  if (!current && !next) return null;
  return <div className="ticket" data-testid="now-next">{current && <Stub item={current} label="Happening now" live />}{current && next && <div className="ticket-perf" />}{next && <Stub item={next} label="Next" />}</div>;
}
export function TodayPage() {
  const { b, today, nowTime, state, canEdit, addActivity, personName } = useEvent();
  const base = `/events/${b.event.id}`;
  const day = b.days.find((d) => d.day_date === today);
  const items = day ? sortItems(b.items.filter((i) => i.event_day_id === day.id)) : [];
  const nn = currentAndNext(items, nowTime);
  const dayIds = new Set(items.map((i) => i.id));
  const tasks = b.tasks.filter((t) => t.status !== 'done' && ((t.due_date != null && t.due_date <= today) || (t.itinerary_item_id && dayIds.has(t.itinerary_item_id))));
  const pinned = b.notes.filter((n) => n.is_pinned);
  if (state !== 'active' || !day) return (
    <EmptyState icon={CalendarCheck} title={state === 'upcoming' ? 'Today view starts when the event does' : 'This event has ended'} body={`${b.event.title} runs ${formatDayLong(b.event.start_date)} to ${formatDayLong(b.event.end_date)}.`}><Button asChild><Link to={`${base}/agenda`}>See the agenda</Link></Button></EmptyState>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-6">
      <div><p className="text-ink-soft">{b.event.title}</p><h2 className="font-display text-[30px] font-bold leading-tight">{formatDayLong(today)}</h2></div>
      <NowNext {...nn} />
      {pinned.length > 0 && <section className="space-y-2">{pinned.slice(0, 3).map((n) => <Link to={`${base}/notes`} key={n.id} className="block rounded-2xl bg-gold-soft p-3.5"><span className="font-semibold">{n.title}</span>{n.body && <p className="line-clamp-2 text-[15px]">{n.body}</p>}</Link>)}</section>}
      <section><SectionTitle action={canEdit ? <Button size="sm" variant="soft" onClick={() => addActivity({ event_day_id: day.id })}><Plus className="h-4 w-4" />Add</Button> : undefined}>Schedule</SectionTitle>
        {items.length ? <DayTimeline items={items} /> : <p className="text-ink-soft">Nothing planned today.</p>}</section>
      {tasks.length > 0 && <section><SectionTitle>Still to do</SectionTitle><ul className="space-y-2">{tasks.map((t) => <li key={t.id}><Link to={`${base}/tasks`} className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-card px-3.5 py-2.5 shadow-soft"><span className="font-medium">{t.title}</span>{t.assignee_id && <span className="shrink-0 text-[15px] text-ink-soft">{personName(t.assignee_id)}</span>}</Link></li>)}</ul></section>}
    </div>
  );
}
