import type { EventRow, EventState } from './types';
// Dates are plain 'YYYY-MM-DD' wall-clock values. Formatting pins UTC so the viewer's zone can never shift a day.
const d = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00Z`);
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(d(s));

export function nowInZone(tz: string, at: Date = new Date()): { date: string; time: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
export const addDays = (s: string, n: number) => new Date(d(s).getTime() + n * 86400000).toISOString().slice(0, 10);

export function eventState(e: Pick<EventRow, 'start_date' | 'end_date' | 'timezone'>, at: Date = new Date()): EventState {
  const today = nowInZone(e.timezone, at).date;
  if (today < e.start_date) return 'upcoming';
  return today > e.end_date ? 'completed' : 'active';
}
export function countdownLabel(e: Pick<EventRow, 'start_date' | 'end_date' | 'timezone'>, at: Date = new Date()) {
  const today = nowInZone(e.timezone, at).date;
  const s = eventState(e, at);
  if (s === 'upcoming') { const n = daysBetween(today, e.start_date); return n === 1 ? 'Tomorrow' : `In ${n} days`; }
  if (s === 'active') return `Day ${daysBetween(e.start_date, today) + 1} of ${daysBetween(e.start_date, e.end_date) + 1}`;
  return 'Completed';
}
export const formatDayLong = (s: string) => fmt(s, { weekday: 'long', month: 'long', day: 'numeric' });
export const formatDayShort = (s: string) => fmt(s, { weekday: 'short', month: 'short', day: 'numeric' });
export const formatWeekday = (s: string) => fmt(s, { weekday: 'short' });
export const formatDayNum = (s: string) => fmt(s, { day: 'numeric' });
export function formatRange(a: string, b: string) {
  if (a === b) return fmt(a, { month: 'short', day: 'numeric', year: 'numeric' });
  const same = a.slice(0, 7) === b.slice(0, 7);
  return `${fmt(a, { month: 'short', day: 'numeric' })} – ${same ? fmt(b, { day: 'numeric' }) : fmt(b, { month: 'short', day: 'numeric' })}, ${b.slice(0, 4)}`;
}
export function formatTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** Postgres timestamps come back as 'YYYY-MM-DDTHH:MM:SS'; datetime-local wants minutes. */
export const toLocalInput = (ts?: string | null) => (ts ? ts.replace(' ', 'T').slice(0, 16) : '');
export const formatLocalStamp = (ts?: string | null) => (ts ? `${formatDayShort(ts)}, ${formatTime(ts.replace(' ', 'T').slice(11, 16))}` : '');
export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
export function timeAgo(iso: string, at: Date = new Date()) {
  const s = Math.max(0, (at.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
export const commonTimeZones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Mexico_City', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
