/** @jest-environment node */
import { Temporal } from 'temporal-polyfill';
import {
  setTemporal, getTemporal, parse, add, subtract, startOf, endOf, diff, compare, isBefore, isAfter, isSame, isBetween,
  isWeekend, isLeapYear, daysInMonth, min, max, clamp, eachDay, inTimeZone, format, formatIntl, toDate, toPlainDate, toZoned, today, now,
} from '../src';

const TZ = 'Asia/Tashkent';

describe('without Temporal', () => {
  it('throws a helpful error', () => {
    expect(() => getTemporal()).toThrow(/npm install temporal-polyfill/);
  });
});

describe('temporal-dates', () => {
  beforeAll(() => setTemporal(Temporal as never));

  it('parse picks the right type', () => {
    expect(parse('2026-03-05').toString()).toBe('2026-03-05');
    expect(Object.prototype.toString.call(parse('2026-03-05T10:00'))).toBe('[object Temporal.PlainDateTime]');
    expect(parse('2026-03-05T10:00:00Z', { timeZone: TZ }).toString()).toBe('2026-03-05T15:00:00+05:00[Asia/Tashkent]');
    expect(parse('2026-03-05T10:00:00+05:00[Asia/Tashkent]').toString()).toBe('2026-03-05T10:00:00+05:00[Asia/Tashkent]');
  });

  it('add/subtract keep the input type', () => {
    const d = Temporal.PlainDate.from('2026-01-31');
    expect(add(d, { months: 1 }).toString()).toBe('2026-02-28');
    expect(subtract(d, { days: 31 }).toString()).toBe('2025-12-31');

    const js = new Date('2026-01-01T00:00:00Z');
    const r = add(js, { hours: 36 }, { timeZone: 'UTC' });
    expect(r).toBeInstanceOf(Date);
    expect(r.toISOString()).toBe('2026-01-02T12:00:00.000Z');

    const inst = Temporal.Instant.from('2026-01-01T00:00:00Z');
    expect(add(inst, { days: 1 }, { timeZone: 'UTC' }).toString()).toBe('2026-01-02T00:00:00Z');

    expect(add('2026-01-01T00:00:00Z', { minutes: 5 }, { timeZone: TZ }).toString()).toBe('2026-01-01T05:05:00+05:00[Asia/Tashkent]');
  });

  it('startOf / endOf', () => {
    const z = Temporal.ZonedDateTime.from('2026-11-12T15:47:30+05:00[Asia/Tashkent]'); // Thursday
    expect(startOf(z, 'month').toString()).toBe('2026-11-01T00:00:00+05:00[Asia/Tashkent]');
    expect(startOf(z, 'week').toString()).toBe('2026-11-09T00:00:00+05:00[Asia/Tashkent]');
    expect(startOf(z, 'week', { weekStartsOn: 7 }).toString()).toBe('2026-11-08T00:00:00+05:00[Asia/Tashkent]');
    expect(startOf(z, 'hour').toString()).toBe('2026-11-12T15:00:00+05:00[Asia/Tashkent]');
    expect(endOf(z, 'day').toString()).toBe('2026-11-12T23:59:59.999999999+05:00[Asia/Tashkent]');
    expect(endOf(Temporal.PlainDate.from('2028-02-10'), 'month').toString()).toBe('2028-02-29');
    expect(startOf(Temporal.PlainDate.from('2026-07-19'), 'year').toString()).toBe('2026-01-01');
  });

  it('diff truncates like date-fns', () => {
    expect(diff('2026-03-01', '2026-01-15', 'day')).toBe(45);
    expect(diff('2026-03-01', '2026-01-15', 'month')).toBe(1);
    expect(diff(Temporal.PlainDate.from('2026-03-10'), Temporal.PlainDate.from('2000-03-11'), 'year')).toBe(25);
    expect(diff('2026-01-01T10:30:00Z', '2026-01-01T08:00:00Z', 'hour', { timeZone: 'UTC' })).toBe(2);
    expect(diff('2026-01-01T08:00:00Z', '2026-01-01T10:30:00Z', 'minute', { timeZone: 'UTC' })).toBe(-150);
  });

  it('comparisons', () => {
    expect(compare('2026-01-02', '2026-01-01')).toBe(1);
    expect(isBefore(new Date('2026-01-01'), new Date('2026-01-02'))).toBe(true);
    expect(isAfter('2026-01-01T00:00:01Z', '2026-01-01T00:00:00Z')).toBe(true);
    expect(isSame('2026-01-01T01:00:00Z', '2026-01-01T22:00:00Z', 'day', { timeZone: 'UTC' })).toBe(true);
    expect(isSame('2026-01-01T01:00:00Z', '2026-01-01T22:00:00Z', 'day', { timeZone: TZ })).toBe(false);
    expect(isBetween('2026-05-05', '2026-05-01', '2026-05-05')).toBe(true);
    expect(isBetween('2026-05-05', '2026-05-01', '2026-05-05', false)).toBe(false);
    const dates = ['2026-03-01', '2025-01-01', '2026-01-01'].map((s) => Temporal.PlainDate.from(s));
    expect(dates.sort(compare).map(String)).toEqual(['2025-01-01', '2026-01-01', '2026-03-01']);
    expect(min(...dates).toString()).toBe('2025-01-01');
    expect(max(...dates).toString()).toBe('2026-03-01');
    expect(clamp(Temporal.PlainDate.from('2027-01-01'), dates[0], dates[2]).toString()).toBe('2026-03-01');
  });

  it('calendar helpers', () => {
    expect(isWeekend('2026-11-14')).toBe(true);
    expect(isLeapYear('2028-06-01')).toBe(true);
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(eachDay('2026-12-30', '2027-01-02').map(String)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(today(TZ).toString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(now(TZ).timeZoneId).toBe(TZ);
  });

  it('conversions and time zones', () => {
    const z = inTimeZone('2026-01-01T00:00:00Z', 'America/New_York');
    expect(z.toString()).toBe('2025-12-31T19:00:00-05:00[America/New_York]');
    expect(toDate(z).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toPlainDate(new Date('2026-01-01T22:00:00Z'), { timeZone: TZ }).toString()).toBe('2026-01-02');
    expect(toZoned(1_767_225_600_000, { timeZone: 'UTC' }).toString()).toBe('2026-01-01T00:00:00+00:00[UTC]');
  });

  it('format with tokens and locales', () => {
    const z = Temporal.ZonedDateTime.from('2026-11-05T09:07:03.045+05:00[Asia/Tashkent]');
    expect(format(z, 'yyyy-MM-dd HH:mm:ss.SSS xxx')).toBe('2026-11-05 09:07:03.045 +05:00');
    expect(format(z, "d MMMM yyyy 'yil'", { locale: 'uz' })).toBe('5 noyabr 2026 yil');
    expect(format(z, 'EEEE, MMM d', { locale: 'en' })).toBe('Thursday, Nov 5');
    expect(format(z, 'h:mm a', { locale: 'en' })).toBe('9:07 AM');
    expect(format(Temporal.PlainDate.from('2026-01-02'), 'dd.MM.yy')).toBe('02.01.26');
    expect(format(new Date('2026-01-01T00:00:00Z'), 'yyyy-MM-dd HH:mm xxx', { timeZone: 'UTC' })).toBe('2026-01-01 00:00 Z');
    expect(formatIntl(Temporal.PlainDate.from('2026-11-05'), { dateStyle: 'long' }, 'en')).toBe('November 5, 2026');
  });
});
