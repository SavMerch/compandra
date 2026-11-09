import * as React from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Lightbulb, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, Segmented } from '@/components/ui/misc';
import { useIsDesktop } from '@/components/ui/sheet';
import { rpc } from '@/data/api';
import { keys } from '@/data/hooks';
import { formatDayLong, formatDayNum, formatDayShort, formatTime, formatWeekday } from '@/domain/time';
import { sortItems } from '@/domain/schedule';
import { cn } from '@/lib/utils';
import type { EventBundle, ItineraryItem } from '@/domain/types';
import { useEvent } from './EventContext';
import { ActivityRow, DragGrip } from './ActivityRow';

const IDEAS = 'ideas';
function SortableRow({ item, compact, enabled }: { item: ItineraryItem; compact?: boolean; enabled: boolean }) {
  const s = useSortable({ id: item.id, disabled: !enabled });
  return (
    <div ref={s.setNodeRef} style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition, zIndex: s.isDragging ? 20 : undefined, position: 'relative' }} className={cn(s.isDragging && 'opacity-80')}>
      <ActivityRow item={item} compact={compact} handle={enabled ? <DragGrip {...s.attributes} {...s.listeners} /> : undefined} />
    </div>
  );
}
function Column({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn(className, isOver && 'rounded-2xl ring-2 ring-teal/40')}>{children}</div>;
}
function useMove() {
  const { b, run, canEdit } = useEvent();
  const qc = useQueryClient();
  const colOf = (itemId: string) => { const i = b.items.find((x) => x.id === itemId); return i?.event_day_id ?? IDEAS; };
  const listOf = (col: string) => sortItems(b.items.filter((i) => (i.event_day_id ?? IDEAS) === col));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || !canEdit) return;
    const id = String(e.active.id), over = String(e.over.id);
    const from = colOf(id);
    const to = over === IDEAS || b.days.some((d) => d.id === over) ? over : colOf(over);
    const item = b.items.find((i) => i.id === id)!;
    if (from !== to && item.source_type) return;
    let ids = listOf(to).map((i) => i.id);
    if (from === to) { const a = ids.indexOf(id), z = ids.indexOf(over); if (a < 0 || z < 0 || a === z) return; ids = arrayMove(ids, a, z); }
    else { const z = ids.indexOf(over); ids.splice(z < 0 ? ids.length : z, 0, id); }
    const day = to === IDEAS ? null : to;
    qc.setQueryData<EventBundle>(keys.bundle(b.event.id), (o) => o && ({ ...o, items: o.items.map((i) => { const n = ids.indexOf(i.id); return n < 0 ? i : { ...i, event_day_id: i.id === id ? day : i.event_day_id, position: (n + 1) * 1000 }; }) }));
    void run(() => rpc('move_itinerary_item', { p_item: id, p_day: day, p_ordered: ids }));
  };
  return { listOf, onDragEnd };
}
function DndShell({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (e: DragEndEvent) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>{children}</DndContext>;
}
export function DayTimeline({ items }: { items: ItineraryItem[] }) {
  const { today, nowTime, b } = useEvent();
  const dayIsToday = items[0] && b.days.find((d) => d.id === items[0].event_day_id)?.day_date === today;
  return (
    <ol className="relative">
      {items.map((i) => {
        const past = dayIsToday && i.start_time && (i.end_time ?? i.start_time).slice(0, 5) < nowTime;
        return (
          <li key={i.id} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 pb-2.5">
            <div className={cn('pt-3.5 text-right text-[14px] font-semibold', past ? 'text-ink-soft/60' : 'text-ink')}>{i.is_all_day ? 'All day' : i.start_time ? formatTime(i.start_time).replace(' ', ' ') : ''}</div>
            <div className="border-l-2 border-line pl-2.5"><ActivityRow item={i} /></div>
          </li>
        );
      })}
    </ol>
  );
}
export function AgendaPage() {
  const { b, canEdit, today, addActivity } = useEvent();
  const desktop = useIsDesktop();
  const { listOf, onDragEnd } = useMove();
  const [view, setView] = React.useState<'timeline' | 'compact' | 'all'>('timeline');
  const [day, setDay] = React.useState(() => (b.days.find((d) => d.day_date === today) ?? b.days[0])?.id ?? IDEAS);
  const stripRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { stripRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [day]);
  const ideasCount = listOf(IDEAS).length;

  if (desktop) return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Agenda</h2>{canEdit && <Button onClick={() => addActivity()}><Plus className="h-5 w-5" />Add activity</Button>}</div>
      <p className="mb-4 text-ink-soft">Drag activities between days and Ideas. Timed activities stay in time order within a day.</p>
      <DndShell onDragEnd={onDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {[...b.days.map((d) => ({ id: d.id, title: formatDayShort(d.day_date), date: d.day_date })), { id: IDEAS, title: 'Ideas', date: '' }].map((c) => {
            const list = listOf(c.id);
            return (
              <section key={c.id} aria-label={c.title} className={cn('w-72 shrink-0 rounded-2xl p-2.5', c.id === IDEAS ? 'bg-gold-soft' : 'bg-sand', c.date === today && 'ring-2 ring-accent')}>
                <div className="mb-2 flex items-center justify-between px-1.5"><h3 className="font-display text-lg font-semibold">{c.title}</h3>{canEdit && <button aria-label={`Add to ${c.title}`} onClick={() => addActivity({ event_day_id: c.id === IDEAS ? null : c.id })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-card"><Plus className="h-5 w-5" /></button>}</div>
                <SortableContext id={c.id} items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <Column id={c.id} className="min-h-24 space-y-2">{list.map((i) => <div key={i.id}>{i.start_time && <div className="px-1.5 text-[13px] font-semibold text-ink-soft">{formatTime(i.start_time)}</div>}<SortableRow item={i} enabled={canEdit && (!i.source_type)} /></div>)}</Column>
                </SortableContext>
              </section>
            );
          })}
        </div>
      </DndShell>
    </div>
  );

  const list = listOf(day);
  const empty = day === IDEAS
    ? <EmptyState icon={Lightbulb} title="Save ideas for later" body="Keep restaurants and activities here until you pick a time.">{canEdit && <Button onClick={() => addActivity({ event_day_id: null })}>Add an idea</Button>}</EmptyState>
    : <EmptyState icon={CalendarPlus} title="Nothing planned yet" body="Add the first activity for this day.">{canEdit && <Button onClick={() => addActivity({ event_day_id: day })}>Add activity</Button>}</EmptyState>;
  return (
    <div>
      <div ref={stripRef} role="tablist" aria-label="Days" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {b.days.map((d) => (
          <button key={d.id} role="tab" aria-selected={day === d.id} aria-label={formatDayLong(d.day_date)} onClick={() => { setDay(d.id); if (view === 'all') setView('timeline'); }}
            className={cn('flex h-[4.25rem] w-14 shrink-0 flex-col items-center justify-center rounded-2xl', day === d.id && view !== 'all' ? 'bg-ink text-white' : 'bg-card shadow-soft', d.day_date === today && day !== d.id && 'text-accent')}>
            <span className="text-[13px] font-medium">{formatWeekday(d.day_date)}</span><span className="font-display text-[22px] font-semibold leading-none">{formatDayNum(d.day_date)}</span>
          </button>
        ))}
        <button role="tab" aria-selected={day === IDEAS} aria-label="Ideas" onClick={() => { setDay(IDEAS); setView('timeline'); }} className={cn('flex h-[4.25rem] w-16 shrink-0 flex-col items-center justify-center rounded-2xl', day === IDEAS ? 'bg-gold text-white' : 'bg-gold-soft text-gold')}><Lightbulb className="h-5 w-5" aria-hidden /><span className="text-[13px] font-semibold">Ideas{ideasCount ? ` ${ideasCount}` : ''}</span></button>
      </div>
      <div className="px-4">
        {day !== IDEAS && <div className="mb-3"><Segmented label="View" value={view} onChange={setView} options={[{ value: 'timeline', label: 'Timeline' }, { value: 'compact', label: 'Compact' }, { value: 'all', label: 'All days' }]} /></div>}
        {view === 'all' ? <div className="space-y-5">{b.days.map((d) => { const l = listOf(d.id); return <section key={d.id}><button className="mb-1.5 font-display text-lg font-semibold" onClick={() => { setDay(d.id); setView('timeline'); }}>{formatDayLong(d.day_date)}</button>{l.length ? <div className="space-y-1.5">{l.map((i) => <ActivityRow key={i.id} item={i} compact />)}</div> : <p className="text-ink-soft">Nothing planned</p>}</section>; })}</div>
          : <>
            {day !== IDEAS && <h2 className="mb-3 font-display text-[21px] font-semibold">{formatDayLong(b.days.find((d) => d.id === day)!.day_date)}</h2>}
            {!list.length ? empty : view === 'timeline' && day !== IDEAS ? <DayTimeline items={list} /> : (
              <DndShell onDragEnd={onDragEnd}><SortableContext id={day} items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}><Column id={day} className="space-y-2">{list.map((i) => <SortableRow key={i.id} item={i} compact={day !== IDEAS} enabled={canEdit && !i.start_time && !i.is_all_day} />)}</Column></SortableContext></DndShell>
            )}
          </>}
      </div>
    </div>
  );
}
