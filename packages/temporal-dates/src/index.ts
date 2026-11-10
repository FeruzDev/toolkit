import type { Temporal as T } from 'temporal-spec';

export type { Temporal } from 'temporal-spec';

type TemporalNS = typeof T;

let custom: TemporalNS | undefined;

/**
 * Use a specific Temporal implementation (e.g. a polyfill) instead of `globalThis.Temporal`.
 *
 * @example
 * import { Temporal } from 'temporal-polyfill';
 * setTemporal(Temporal);
 */
export function setTemporal(temporal: TemporalNS): void {
  custom = temporal;
}

/** The Temporal namespace in use. Throws a helpful error when none is available. */
export function getTemporal(): TemporalNS {
  const t = custom ?? (globalThis as { Temporal?: TemporalNS }).Temporal;
  if (!t) {
    throw new Error(
      'temporal-dates: Temporal is not available in this runtime. Install a polyfill:\n' +
        '  npm install temporal-polyfill\n' +
        "  import 'temporal-polyfill/global'   // once, at app start\n" +
        "or call setTemporal(Temporal) with any implementation.",
    );
  }
  return t;
}

/** Anything the helpers accept. Strings are ISO 8601; numbers are epoch milliseconds. */
export type DateInput = T.PlainDate | T.PlainDateTime | T.ZonedDateTime | T.Instant | Date | string | number;

/** Return type mirrors the input type: Date → Date, PlainDate → PlainDate, string/number → ZonedDateTime. */
export type Same<V> = V extends Date
  ? Date
  : V extends T.PlainDate
    ? T.PlainDate
    : V extends T.PlainDateTime
      ? T.PlainDateTime
      : V extends T.Instant
        ? T.Instant
        : T.ZonedDateTime;

export type Unit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';

export interface ZoneOptions {
  /** IANA time zone for Date/number/Instant inputs. @default system time zone */
  timeZone?: string;
}

type Kind = 'date' | 'datetime' | 'zoned' | 'instant' | 'js' | 'other';

function kindOf(v: unknown): Kind {
  if (v instanceof Date) return 'js';
  const tag = Object.prototype.toString.call(v);
  if (tag === '[object Temporal.PlainDate]') return 'date';
  if (tag === '[object Temporal.PlainDateTime]') return 'datetime';
  if (tag === '[object Temporal.ZonedDateTime]') return 'zoned';
  if (tag === '[object Temporal.Instant]') return 'instant';
  return 'other';
}

const systemZone = () => getTemporal().Now.timeZoneId();

/** Current moment in a time zone. */
export function now(timeZone: string = systemZone()): T.ZonedDateTime {
  return getTemporal().Now.zonedDateTimeISO(timeZone);
}

/** Today's calendar date in a time zone. */
export function today(timeZone: string = systemZone()): T.PlainDate {
  return getTemporal().Now.plainDateISO(timeZone);
}

/**
 * Parse an ISO 8601 string into the most fitting Temporal type:
 * `2026-03-05` → PlainDate, `2026-03-05T10:00` → PlainDateTime,
 * `2026-03-05T10:00Z` / with offset → ZonedDateTime (in `timeZone`), `…[Asia/Tashkent]` → ZonedDateTime.
 */
export function parse(input: string, options: ZoneOptions = {}): T.PlainDate | T.PlainDateTime | T.ZonedDateTime {
  const Temporal = getTemporal();
  const s = input.trim();
  if (/\[[^\]]+\]$/.test(s)) return Temporal.ZonedDateTime.from(s);
  if (/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s) && /T|\s\d/.test(s)) {
    return Temporal.Instant.from(s.replace(' ', 'T')).toZonedDateTimeISO(options.timeZone ?? systemZone());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Temporal.PlainDate.from(s);
  return Temporal.PlainDateTime.from(s.replace(' ', 'T'));
}

/** Convert any input to a ZonedDateTime (PlainDate → start of day). */
export function toZoned(value: DateInput, options: ZoneOptions = {}): T.ZonedDateTime {
  const Temporal = getTemporal();
  const tz = options.timeZone ?? systemZone();
  switch (kindOf(value)) {
    case 'zoned':
      return options.timeZone ? (value as T.ZonedDateTime).withTimeZone(tz) : (value as T.ZonedDateTime);
    case 'instant':
      return (value as T.Instant).toZonedDateTimeISO(tz);
    case 'date':
      return (value as T.PlainDate).toZonedDateTime({ timeZone: tz });
    case 'datetime':
      return (value as T.PlainDateTime).toZonedDateTime(tz);
    case 'js':
      return Temporal.Instant.fromEpochMilliseconds((value as Date).getTime()).toZonedDateTimeISO(tz);
    default:
      if (typeof value === 'number') return Temporal.Instant.fromEpochMilliseconds(value).toZonedDateTimeISO(tz);
      if (typeof value === 'string') return toZoned(parse(value, options), options);
      throw new TypeError(`temporal-dates: unsupported date value ${String(value)}`);
  }
}

/** Calendar date of any input. */
export function toPlainDate(value: DateInput, options: ZoneOptions = {}): T.PlainDate {
  const k = kindOf(value);
  if (k === 'date') return value as T.PlainDate;
  if (k === 'datetime') return (value as T.PlainDateTime).toPlainDate();
  return toZoned(value, options).toPlainDate();
}

/** JavaScript `Date` of any input (PlainDate/PlainDateTime use the system or given time zone). */
export function toDate(value: DateInput, options: ZoneOptions = {}): Date {
  if (value instanceof Date) return new Date(value.getTime());
  return new Date(toZoned(value, options).epochMilliseconds);
}

/** Epoch milliseconds of any input. */
export function toEpochMs(value: DateInput, options: ZoneOptions = {}): number {
  return value instanceof Date ? value.getTime() : toZoned(value, options).epochMilliseconds;
}

type Workable = T.PlainDate | T.PlainDateTime | T.ZonedDateTime;

/** Run `fn` on a workable Temporal value and convert the result back to the input's type. */
function withSame<V extends DateInput>(value: V, options: ZoneOptions, fn: (w: Workable) => Workable): Same<V> {
  const k = kindOf(value);
  if (k === 'date' || k === 'datetime' || k === 'zoned') return fn(value as Workable) as Same<V>;
  const zoned = fn(toZoned(value, options)) as T.ZonedDateTime;
  if (k === 'js') return new Date(zoned.epochMilliseconds) as Same<V>;
  if (k === 'instant') return zoned.toInstant() as Same<V>;
  return zoned as Same<V>;
}

/**
 * Add a duration. Returns the same type you pass in.
 *
 * @example
 * add(today(), { days: 3 })                    // PlainDate
 * add(new Date(), { hours: 2 })                // Date
 * add('2026-01-31', { months: 1 })             // 2026-02-28 (clamped)
 */
export function add<V extends DateInput>(value: V, duration: T.DurationLike, options: ZoneOptions = {}): Same<V> {
  return withSame(value, options, (w) => w.add(duration as never));
}

/** Subtract a duration. Returns the same type you pass in. */
export function subtract<V extends DateInput>(value: V, duration: T.DurationLike, options: ZoneOptions = {}): Same<V> {
  return withSame(value, options, (w) => w.subtract(duration as never));
}

export interface StartOfOptions extends ZoneOptions {
  /** First day of the week, 1 = Monday … 7 = Sunday. @default 1 */
  weekStartsOn?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function floorTo(w: Workable, unit: Unit, weekStartsOn: number): Workable {
  const k = kindOf(w);
  let date = 'toPlainDate' in w && k !== 'date' ? (w as T.ZonedDateTime).toPlainDate() : (w as T.PlainDate);
  if (unit === 'year') date = date.with({ month: 1, day: 1 });
  else if (unit === 'month') date = date.with({ day: 1 });
  else if (unit === 'week') date = date.subtract({ days: (date.dayOfWeek - weekStartsOn + 7) % 7 });

  if (k === 'date') return date;
  if (['year', 'month', 'week', 'day'].includes(unit)) {
    if (k === 'zoned') return date.toZonedDateTime({ timeZone: (w as T.ZonedDateTime).timeZoneId });
    return date.toPlainDateTime();
  }
  return (w as T.ZonedDateTime).round({ smallestUnit: unit as 'hour', roundingMode: 'floor' });
}

/**
 * Start of a unit (`'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'`).
 *
 * @example
 * startOf(now(), 'month')   // first day of month, 00:00, same zone
 * startOf(new Date(), 'week', { weekStartsOn: 1 })
 */
export function startOf<V extends DateInput>(value: V, unit: Unit, options: StartOfOptions = {}): Same<V> {
  return withSame(value, options, (w) => floorTo(w, unit, options.weekStartsOn ?? 1));
}

/** End of a unit: last day for PlainDate, last nanosecond otherwise. */
export function endOf<V extends DateInput>(value: V, unit: Unit, options: StartOfOptions = {}): Same<V> {
  return withSame(value, options, (w) => {
    const start = floorTo(w, unit, options.weekStartsOn ?? 1);
    const next = start.add({ [`${unit}s`]: 1 } as never);
    return kindOf(w) === 'date' ? next.subtract({ days: 1 }) : next.subtract({ nanoseconds: 1 });
  });
}

/**
 * Difference `a - b` in a unit, truncated towards zero (like date-fns `differenceInX`).
 *
 * @example
 * diff('2026-03-01', '2026-01-15', 'day')   // 45
 * diff(new Date(), birthday, 'year')        // age
 */
export function diff(a: DateInput, b: DateInput, unit: Unit, options: ZoneOptions = {}): number {
  const ka = kindOf(a);
  const kb = kindOf(b);
  const bothDates = (ka === 'date' || (typeof a === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a))) &&
    (kb === 'date' || (typeof b === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b)));
  // `since` with smallestUnit === largestUnit and trunc rounding gives calendar-correct whole units
  // (e.g. 2000-03-11 → 2026-03-10 is 25 years, not 26).
  const field = `${unit}s` as 'days';
  const opts = { largestUnit: unit, smallestUnit: unit, roundingMode: 'trunc' } as const;
  if (bothDates && ['year', 'month', 'week', 'day'].includes(unit)) {
    return toPlainDate(a).since(toPlainDate(b), opts as never)[field] || 0;
  }
  const za = toZoned(a, options);
  const zb = toZoned(b, options).withTimeZone(za.timeZoneId);
  return za.since(zb, opts as never)[field] || 0;
}

/** -1, 0 or 1 — usable with `Array.prototype.sort`. Compares exact instants (PlainDate = start of day). */
export function compare(a: DateInput, b: DateInput, options: ZoneOptions = {}): -1 | 0 | 1 {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka === 'date' && kb === 'date') return getTemporal().PlainDate.compare(a as T.PlainDate, b as T.PlainDate) as -1 | 0 | 1;
  const x = toEpochNs(a, options);
  const y = toEpochNs(b, options);
  return x < y ? -1 : x > y ? 1 : 0;
}

const toEpochNs = (v: DateInput, o: ZoneOptions) => toZoned(v, o).epochNanoseconds;

export const isBefore = (a: DateInput, b: DateInput, options?: ZoneOptions) => compare(a, b, options) < 0;
export const isAfter = (a: DateInput, b: DateInput, options?: ZoneOptions) => compare(a, b, options) > 0;
export const isEqual = (a: DateInput, b: DateInput, options?: ZoneOptions) => compare(a, b, options) === 0;

/** Same calendar unit? `isSame(a, b, 'day')`, `'month'`, `'year'`… */
export function isSame(a: DateInput, b: DateInput, unit: Unit, options: StartOfOptions = {}): boolean {
  return compare(startOf(toZoned(a, options), unit, options), startOf(toZoned(b, options), unit, options)) === 0;
}

/** `start <= value <= end` (inclusive by default). */
export function isBetween(value: DateInput, start: DateInput, end: DateInput, inclusive = true, options?: ZoneOptions): boolean {
  const lo = compare(value, start, options);
  const hi = compare(value, end, options);
  return inclusive ? lo >= 0 && hi <= 0 : lo > 0 && hi < 0;
}

export const isToday = (value: DateInput, options: ZoneOptions = {}) =>
  toPlainDate(value, options).equals(today(options.timeZone ?? systemZone()));
export const isWeekend = (value: DateInput, options: ZoneOptions = {}) => toPlainDate(value, options).dayOfWeek >= 6;
export const isLeapYear = (value: DateInput, options: ZoneOptions = {}) => toPlainDate(value, options).inLeapYear;
export const daysInMonth = (value: DateInput, options: ZoneOptions = {}) => toPlainDate(value, options).daysInMonth;

/** Earliest of the values. */
export function min<V extends DateInput>(...values: V[]): V {
  return values.reduce((a, b) => (compare(b, a) < 0 ? b : a));
}
/** Latest of the values. */
export function max<V extends DateInput>(...values: V[]): V {
  return values.reduce((a, b) => (compare(b, a) > 0 ? b : a));
}
/** Clamp into `[lo, hi]`. */
export function clamp<V extends DateInput>(value: V, lo: V, hi: V): V {
  return compare(value, lo) < 0 ? lo : compare(value, hi) > 0 ? hi : value;
}

/** Every calendar day from `start` to `end` (inclusive). */
export function eachDay(start: DateInput, end: DateInput, options: ZoneOptions = {}): T.PlainDate[] {
  const out: T.PlainDate[] = [];
  let d = toPlainDate(start, options);
  const last = toPlainDate(end, options);
  while (getTemporal().PlainDate.compare(d, last) <= 0) {
    out.push(d);
    d = d.add({ days: 1 });
  }
  return out;
}

/** Same instant in another time zone. */
export function inTimeZone(value: DateInput, timeZone: string): T.ZonedDateTime {
  return toZoned(value).withTimeZone(timeZone);
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

export interface FormatOptions extends ZoneOptions {
  /** Locale for names (MMM, EEEE, a). @default runtime locale */
  locale?: string | string[];
}

type Fields = { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number; dayOfWeek: number };

function fieldsOf(value: DateInput, options: ZoneOptions): { f: Fields; zoned?: T.ZonedDateTime } {
  const k = kindOf(value);
  if (k === 'date') {
    const d = value as T.PlainDate;
    return { f: { year: d.year, month: d.month, day: d.day, hour: 0, minute: 0, second: 0, millisecond: 0, dayOfWeek: d.dayOfWeek } };
  }
  const v = k === 'datetime' ? (value as T.PlainDateTime) : toZoned(value, options);
  return {
    f: { year: v.year, month: v.month, day: v.day, hour: v.hour, minute: v.minute, second: v.second, millisecond: v.millisecond, dayOfWeek: v.dayOfWeek },
    zoned: kindOf(v) === 'zoned' ? (v as T.ZonedDateTime) : undefined,
  };
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/**
 * Format with date-fns style tokens. Text in single quotes is literal.
 *
 * Tokens: `yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm m ss s SSS a xxx`
 *
 * @example
 * format(now(), 'yyyy-MM-dd HH:mm')                        // "2026-11-10 14:05"
 * format(today(), 'd MMMM yyyy', { locale: 'uz' })         // "10 noyabr 2026"
 * format(new Date(), "EEEE, d MMM 'at' HH:mm", { locale: 'en' })
 */
export function format(value: DateInput, pattern: string, options: FormatOptions = {}): string {
  const { f, zoned } = fieldsOf(value, options);
  const jsDate = new Date(Date.UTC(f.year, f.month - 1, f.day, 12));
  const name = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(options.locale, { ...opts, timeZone: 'UTC' }).format(jsDate);
  const monthName = (style: 'long' | 'short') => {
    // standalone month name (nominative), e.g. "noyabr" not "noyabrda"
    const parts = new Intl.DateTimeFormat(options.locale, { month: style, day: 'numeric', timeZone: 'UTC' }).formatToParts(jsDate);
    return parts.find((p) => p.type === 'month')?.value ?? name({ month: style });
  };
  const offset = () => {
    if (!zoned) return '';
    const o = zoned.offset;
    return o === '+00:00' ? 'Z' : o;
  };

  const tokens: Record<string, () => string> = {
    yyyy: () => pad(f.year, 4),
    yy: () => pad(f.year % 100),
    MMMM: () => monthName('long'),
    MMM: () => monthName('short'),
    MM: () => pad(f.month),
    M: () => String(f.month),
    dd: () => pad(f.day),
    d: () => String(f.day),
    EEEE: () => name({ weekday: 'long' }),
    EEE: () => name({ weekday: 'short' }),
    HH: () => pad(f.hour),
    H: () => String(f.hour),
    hh: () => pad(f.hour % 12 || 12),
    h: () => String(f.hour % 12 || 12),
    mm: () => pad(f.minute),
    m: () => String(f.minute),
    ss: () => pad(f.second),
    s: () => String(f.second),
    SSS: () => pad(f.millisecond, 3),
    a: () =>
      new Intl.DateTimeFormat(options.locale ?? 'en', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
        .formatToParts(new Date(Date.UTC(2000, 0, 1, f.hour)))
        .find((p) => p.type === 'dayPeriod')?.value ?? (f.hour < 12 ? 'AM' : 'PM'),
    xxx: offset,
  };

  return pattern.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|m|ss|s|SSS|a|xxx/g, (match, literal?: string) =>
    literal !== undefined ? literal : tokens[match](),
  );
}

/**
 * Locale-aware formatting through `Intl.DateTimeFormat` options.
 *
 * @example
 * formatIntl(now(), { dateStyle: 'medium', timeStyle: 'short' }, 'uz')
 */
export function formatIntl(value: DateInput, intl: Intl.DateTimeFormatOptions, locale?: string | string[], options: ZoneOptions = {}): string {
  const k = kindOf(value);
  if (k === 'date' || k === 'datetime') return (value as T.PlainDate).toLocaleString(locale, intl);
  return toZoned(value, options).toLocaleString(locale, intl);
}
