/** @jest-environment node */
import { formatDuration, formatRelative, parseDuration, ms, splitDuration } from '../src';

describe('formatDuration', () => {
  it.each([
    [3_725_000, {}, '1 hour, 2 minutes'],
    [3_725_000, { locale: 'uz' }, '1 soat 2 daqiqa'],
    [3_725_000, { locale: 'ru' }, '1 час 2 минуты'],
    [93_000, { style: 'narrow' as const }, '1m 33s'],
    [90_061_000, { largest: 3 }, '1 day, 1 hour, 1 minute'],
    [3_599_600, {}, '1 hour'], // 59 min 59.6 s rounds up and carries
    [3_599_600, { round: false }, '59 minutes, 59 seconds'],
    [500, {}, '1 second'],
    [0, {}, '0 seconds'],
    [-120_000, {}, '-2 minutes'],
    [7_200_000, { units: ['minute' as const] }, '120 minutes'],
    [3_725_000, { delimiter: ' + ' }, '1 hour + 2 minutes'],
  ])('%s %j', (value, options, expected) => {
    expect(formatDuration(value, { locale: 'en', ...options })).toBe(expected);
  });

  it('splitDuration', () => {
    expect(splitDuration(90_061_000)).toEqual({ day: 1, hour: 1, minute: 1, second: 1 });
  });
});

describe('formatRelative', () => {
  const now = Date.UTC(2026, 0, 10, 12);
  it.each([
    [now - 180_000, 'en', '3 minutes ago'],
    [now - 180_000, 'uz', '3 daqiqa oldin'],
    [now + 2 * 3_600_000, 'en', 'in 2 hours'],
    [now - 86_400_000, 'en', 'yesterday'],
    [now - 86_400_000, 'ru', 'вчера'],
    [now - 10 * 86_400_000, 'en', 'last week'],
    [now - 1000, 'en', '1 second ago'],
  ])('%s %s', (date, locale, expected) => {
    expect(formatRelative(date, { locale, now })).toBe(expected);
  });

  it('accepts Date and string', () => {
    expect(formatRelative(new Date(now - 60_000), { locale: 'en', now })).toBe('1 minute ago');
    expect(formatRelative(new Date(now - 60_000).toISOString(), { locale: 'en', now: new Date(now) })).toBe('1 minute ago');
  });
});

describe('parseDuration', () => {
  it.each([
    ['1h 30m', 5_400_000],
    ['1h30m', 5_400_000],
    ['1.5 hours', 5_400_000],
    ['2 days', 172_800_000],
    ['1 day, 2 hours and 3 minutes', 93_780_000],
    ['90s', 90_000],
    ['500', 500],
    ['250ms', 250],
    ['01:02:03', 3_723_000],
    ['2:30', 150_000],
    ['PT1H30M', 5_400_000],
    ['P1DT12H', 129_600_000],
    ['-5m', -300_000],
  ])('%s -> %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(['', 'abc', '5 parsecs', '1h abc', 'P', 'PT'])('invalid %j -> NaN', (input) => {
    expect(parseDuration(input)).toBeNaN();
  });
});

describe('ms (compat)', () => {
  it('works like the ms package', () => {
    expect(ms('2 days')).toBe(172_800_000);
    expect(ms('1h')).toBe(3_600_000);
    expect(ms(60_000)).toBe('1m');
    expect(ms(2 * 86_400_000)).toBe('2d');
    expect(ms(1500)).toBe('2s');
    expect(ms(60_000, { long: true })).toBe('1 minute');
    expect(ms(3 * 3_600_000, { long: true })).toBe('3 hours');
  });
});
