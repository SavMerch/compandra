import { Bed, Car, Compass, GripVertical, Link2, Plane, ShoppingBag, Sparkles, Trophy, Utensils, Coffee, Ticket, CircleDot, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/misc';
import { formatTime } from '@/domain/time';
import { cn } from '@/lib/utils';
import type { Category, ItineraryItem } from '@/domain/types';
import { useEvent } from './EventContext';

export const catIcon: Record<Category, LucideIcon> = { activity: Compass, meal: Utensils, travel: Car, flight: Plane, hotel: Bed, competition: Trophy, reservation: Ticket, entertainment: Sparkles, free_time: Coffee, shopping: ShoppingBag, transportation: Car, custom: CircleDot };
export const isRecent = (i: ItineraryItem, me: string) => i.updated_by && i.updated_by !== me && Date.now() - new Date(i.updated_at).getTime() < 86400000 && i.updated_at !== undefined;

export function ActivityRow({ item, compact, handle, active }: { item: ItineraryItem; compact?: boolean; handle?: React.ReactNode; active?: boolean }) {
  const { openItem, peopleOf, personName, userId } = useEvent();
  const Icon = catIcon[item.category] ?? Compass;
  const done = item.status === 'completed', cancelled = item.status === 'cancelled';
  const who = peopleOf(item.id);
  const time = item.is_all_day ? 'All day' : item.start_time ? formatTime(item.start_time) : '';
  return (
    <div className={cn('flex items-stretch rounded-2xl bg-card shadow-soft', active && 'ring-2 ring-accent', (done || cancelled) && 'opacity-60')}>
      {handle}
      <button onClick={() => openItem(item.id)} className={cn('flex min-w-0 flex-1 items-center gap-3 text-left', compact ? 'min-h-12 px-3 py-2' : 'min-h-16 p-3.5', handle && 'pl-0')}>
        {!compact && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal"><Icon className="h-5 w-5" aria-hidden /></span>}
        <span className="min-w-0 flex-1">
          <span className={cn('block font-semibold', cancelled && 'line-through', compact ? 'truncate text-[16px]' : 'text-[17px] leading-snug')}>{item.title}</span>
          {!compact && (item.location_name || who.length > 0) && <span className="block truncate text-[15px] text-ink-soft">{[item.location_name, who.join(', ')].filter(Boolean).join(' with ')}</span>}
          {!compact && (item.is_optional || item.source_type || isRecent(item, userId)) && <span className="mt-1 flex flex-wrap gap-1">
            {item.is_optional && <Badge tone="gold">Optional</Badge>}
            {item.source_type && <Badge><Link2 className="h-3 w-3" aria-hidden />Linked</Badge>}
            {isRecent(item, userId) && <Badge tone="accent">Changed by {personName(item.updated_by)}</Badge>}
          </span>}
        </span>
        {compact && time && <span className="shrink-0 text-[15px] text-ink-soft">{time}</span>}
      </button>
    </div>
  );
}
export const DragGrip = (p: React.ComponentProps<'button'>) => <button aria-label="Drag to move" className="grid w-9 shrink-0 cursor-grab touch-none place-items-center text-ink-soft" {...p}><GripVertical className="h-5 w-5" /></button>;
