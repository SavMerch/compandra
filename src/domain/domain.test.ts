import { describe, expect, it } from 'vitest';
import { addDays, countdownLabel, eventState, formatDayLong, formatRange, formatTime, nowInZone } from './time';
import { currentAndNext, sortItems } from './schedule';
import { guessCategory, packingProgress, parsePackingLines } from './packing';

const E = { start_date: '2027-03-12', end_date: '2027-03-15', timezone: 'America/New_York' };
describe('time', () => {
  it('uses the event zone, not the device zone', () => {
    const at = new Date('2027-03-12T02:00:00Z'); // 9pm Mar 11 in New York, already Mar 12 in UTC
    expect(nowInZone('America/New_York', at).date).toBe('2027-03-11');
    expect(eventState(E, at)).toBe('upcoming');
    expect(eventState({ ...E, timezone: 'UTC' }, at)).toBe('active');
  });
  it('labels lifecycle', () => {
    expect(countdownLabel(E, new Date('2027-03-11T16:00:00Z'))).toBe('Tomorrow');
    expect(countdownLabel(E, new Date('2027-03-14T16:00:00Z'))).toBe('Day 3 of 4');
    expect(eventState(E, new Date('2027-03-16T16:00:00Z'))).toBe('completed');
  });
  it('formats without shifting days', () => {
    expect(formatDayLong('2027-03-12')).toBe('Friday, March 12');
    expect(formatTime('14:05:00')).toBe('2:05 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatRange('2027-03-12', '2027-03-15')).toBe('Mar 12 – 15, 2027');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
});
const it_ = (id: string, s: string | null, e: string | null = null, extra = {}) => ({ id, start_time: s, end_time: e, is_all_day: false, position: 0, status: 'planned' as const, ...extra });
describe('schedule', () => {
  it('sorts all-day, timed, untimed', () => {
    expect(sortItems([it_('u', null), it_('b', '10:00:00'), it_('a', '09:00:00'), it_('x', null, null, { is_all_day: true })]).map((i) => i.id)).toEqual(['x', 'a', 'b', 'u']);
  });
  it('finds current and next', () => {
    const l = [it_('a', '09:00:00', '10:00:00'), it_('b', '10:30:00', '11:00:00'), it_('c', '12:00:00')];
    expect(currentAndNext(l, '09:30')).toMatchObject({ current: { id: 'a' }, next: { id: 'b' } });
    expect(currentAndNext(l, '10:15')).toMatchObject({ current: null, next: { id: 'b' } });
    expect(currentAndNext(l, '12:30').current?.id).toBe('c');
  });
  it('skips completed and cancelled', () => {
    expect(currentAndNext([it_('a', '09:00:00', '10:00:00', { status: 'completed' })], '09:30').current).toBeNull();
  });
});
describe('packing', () => {
  it('turns lines into items', () => {
    const r = parsePackingLines('Sunscreen\n\n- Phone chargers\nSocks x3\n2 Swimsuits\n');
    expect(r.map((x) => x.name)).toEqual(['Sunscreen', 'Phone chargers', 'Socks', 'Swimsuits']);
    expect(r[2].quantity).toBe(3); expect(r[3].quantity).toBe(2);
    expect(r[1].category).toBe('Electronics');
  });
  it('does not treat words as quantities', () => { expect(parsePackingLines('Box of things')[0]).toMatchObject({ name: 'Box of things', quantity: 1 }); });
  it('computes progress', () => { expect(packingProgress([{ is_packed: true }, { is_packed: false }]).pct).toBe(50); expect(packingProgress([]).pct).toBe(0); expect(guessCategory('Passport')).toBe('Travel documents'); });
});
