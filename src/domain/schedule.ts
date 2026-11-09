import type { ItineraryItem } from './types';
type I = Pick<ItineraryItem, 'id' | 'start_time' | 'end_time' | 'is_all_day' | 'position' | 'status'>;

/** All-day first, then chronological; untimed items follow in manual order. */
export function sortItems<T extends I>(items: T[]): T[] {
  const rank = (i: T) => (i.is_all_day ? 0 : i.start_time ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.position - b.position);
}
/** `now` is 'HH:MM' in the event's zone. Default duration is 60 minutes when no end time exists. */
export function currentAndNext<T extends I>(items: T[], now: string): { current: T | null; next: T | null } {
  const active = sortItems(items).filter((i) => i.start_time && !i.is_all_day && i.status !== 'cancelled' && i.status !== 'completed');
  const min = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const n = min(now);
  const end = (i: T) => (i.end_time ? min(i.end_time) : min(i.start_time!) + 60);
  const current = [...active].reverse().find((i) => min(i.start_time!) <= n && n < end(i)) ?? null;
  const next = active.find((i) => min(i.start_time!) > n) ?? null;
  return { current, next };
}
