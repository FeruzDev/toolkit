export type DurationUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';

/** Length of each unit in milliseconds (month = 30 days, year = 365.25 days). */
export const UNIT_MS: Record<DurationUnit, number> = {
  year: 31_557_600_000,
  month: 2_592_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1_000,
  millisecond: 1,
};

const ORDER: DurationUnit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];
const DEFAULT_UNITS: DurationUnit[] = ['year', 'month', 'day', 'hour', 'minute', 'second'];

export interface FormatDurationOptions {
  /** BCP 47 locale: `'en'`, `'uz'`, `'ru'`, `'tr'`, `'de-DE'`… @default runtime locale */
  locale?: string | string[];
  /** `'long'` → "2 hours", `'short'` → "2 hr", `'narrow'` → "2h". @default 'long' */
  style?: 'long' | 'short' | 'narrow';
  /** Max number of units to show. @default 2 */
  largest?: number;
  /** Units allowed in the output, largest first. @default year, month, day, hour, minute, second */
  units?: DurationUnit[];
  /** Round the last shown unit instead of truncating. @default true */
  round?: boolean;
  /** Join with a custom separator instead of the locale's list format. */
  delimiter?: string;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function unitFormat(locale: string | string[] | undefined, unit: DurationUnit, style: 'long' | 'short' | 'narrow') {
  const key = `${locale}|${unit}|${style}`;
  let nf = nfCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: style, maximumFractionDigits: 0 });
    nfCache.set(key, nf);
  }
  return nf;
}

/** Splits milliseconds into unit amounts, e.g. `{ hour: 1, minute: 2 }`. */
export function splitDuration(ms: number, units: DurationUnit[] = DEFAULT_UNITS): Partial<Record<DurationUnit, number>> {
  const sorted = ORDER.filter((u) => units.includes(u));
  const out: Partial<Record<DurationUnit, number>> = {};
  let rest = Math.abs(ms);
  for (const unit of sorted) {
    const amount = Math.floor(rest / UNIT_MS[unit]);
    if (amount) out[unit] = amount;
    rest -= amount * UNIT_MS[unit];
  }
  return out;
}

/**
 * Human-readable duration in any language supported by `Intl` (no locale files needed).
 *
 * @example
 * formatDuration(3_725_000)                        // "1 hour, 2 minutes"
 * formatDuration(3_725_000, { locale: 'uz' })      // "1 soat 2 daqiqa"
 * formatDuration(3_725_000, { locale: 'ru' })      // "1 час 2 минуты"
 * formatDuration(93_000, { style: 'narrow' })      // "1m 33s"
 * formatDuration(90_061_000, { largest: 3 })       // "1 day, 1 hour, 1 minute"
 */
export function formatDuration(ms: number, options: FormatDurationOptions = {}): string {
  const { locale, style = 'long', largest = 2, units = DEFAULT_UNITS, round = true, delimiter } = options;
  const sorted = ORDER.filter((u) => units.includes(u));
  const smallest = sorted[sorted.length - 1] ?? 'second';
  const sign = ms < 0 ? '-' : '';
  const pick = (total: number) => {
    let rest = total;
    const parts: Array<[DurationUnit, number]> = [];
    for (const unit of sorted) {
      if (parts.length >= largest) break;
      const amount = Math.floor(rest / UNIT_MS[unit]);
      if (amount > 0) {
        parts.push([unit, amount]);
        rest -= amount * UNIT_MS[unit];
      }
    }
    return parts;
  };

  let total = Math.abs(ms);
  let parts = pick(total);
  // Round to the smallest shown unit, then split again so carries propagate (59 min 59.6 s -> 1 hour).
  const lastUnit = parts.length ? parts[parts.length - 1][0] : smallest;
  total = (round ? Math.round : Math.floor)(total / UNIT_MS[lastUnit]) * UNIT_MS[lastUnit];
  parts = pick(total);

  if (parts.length === 0) return sign + unitFormat(locale, lastUnit, style).format(0);

  const texts = parts.map(([unit, amount]) => unitFormat(locale, unit, style).format(amount));
  const joined =
    delimiter !== undefined
      ? texts.join(delimiter)
      : typeof Intl.ListFormat === 'function'
        ? new Intl.ListFormat(locale, { type: 'unit', style: style === 'long' ? 'long' : 'narrow' }).format(texts)
        : texts.join(' ');
  return sign + joined;
}

export interface FormatRelativeOptions {
  locale?: string | string[];
  /** `'auto'` → "yesterday", `'always'` → "1 day ago". @default 'auto' */
  numeric?: 'auto' | 'always';
  style?: 'long' | 'short' | 'narrow';
  /** Reference time. @default Date.now() */
  now?: number | Date;
}

/**
 * "3 minutes ago" / "in 2 days" / "kecha" in any language.
 *
 * @example
 * formatRelative(Date.now() - 180_000)                    // "3 minutes ago"
 * formatRelative(Date.now() - 180_000, { locale: 'uz' })  // "3 daqiqa oldin"
 * formatRelative(Date.now() + 2 * 86_400_000, { locale: 'ru' }) // "послезавтра"
 */
export function formatRelative(date: number | Date | string, options: FormatRelativeOptions = {}): string {
  const { locale, numeric = 'auto', style = 'long', now = Date.now() } = options;
  const target = typeof date === 'number' ? date : new Date(date).getTime();
  const diff = target - (typeof now === 'number' ? now : now.getTime());
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric, style });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', UNIT_MS.year],
    ['month', UNIT_MS.month],
    ['week', UNIT_MS.week],
    ['day', UNIT_MS.day],
    ['hour', UNIT_MS.hour],
    ['minute', UNIT_MS.minute],
    ['second', UNIT_MS.second],
  ];
  for (const [unit, size] of units) {
    if (abs >= size || unit === 'second') return rtf.format(Math.round(diff / size), unit);
  }
  return rtf.format(0, 'second');
}

/* ------------------------------------------------------------------ */
/* parsing                                                             */
/* ------------------------------------------------------------------ */

const ALIASES: Record<string, DurationUnit> = {};
const addAliases = (unit: DurationUnit, words: string[]) => words.forEach((w) => (ALIASES[w] = unit));
addAliases('year', ['y', 'yr', 'yrs', 'year', 'years']);
addAliases('month', ['mo', 'mon', 'mos', 'month', 'months']);
addAliases('week', ['w', 'wk', 'wks', 'week', 'weeks']);
addAliases('day', ['d', 'day', 'days']);
addAliases('hour', ['h', 'hr', 'hrs', 'hour', 'hours']);
addAliases('minute', ['m', 'min', 'mins', 'minute', 'minutes']);
addAliases('second', ['s', 'sec', 'secs', 'second', 'seconds']);
addAliases('millisecond', ['ms', 'msec', 'msecs', 'millisecond', 'milliseconds']);

/**
 * Parse a duration string to milliseconds. Returns `NaN` if it cannot be parsed.
 * Accepts `"1h 30m"`, `"1.5 hours"`, `"2 days"`, `"90s"`, `"500"` (ms), `"01:30:00"` and ISO 8601 `"PT1H30M"`.
 *
 * @example
 * parseDuration('1h 30m')   // 5400000
 * parseDuration('PT15M')    // 900000
 * parseDuration('01:02:03') // 3723000
 */
export function parseDuration(input: string): number {
  const text = input.trim().toLowerCase();
  if (!text) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

  const clock = /^(-)?(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.exec(text);
  if (clock) {
    const [, neg, h = '0', m, s, frac = '0'] = clock;
    const value = (+h * 3600 + +m * 60 + +s) * 1000 + Math.round(Number(`0.${frac}`) * 1000);
    return neg ? -value : value;
  }

  const iso = /^(-)?p(?:(\d+(?:\.\d+)?)y)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)w)?(?:(\d+(?:\.\d+)?)d)?(?:t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?)?$/.exec(text);
  if (iso && text !== 'p' && text !== 'pt') {
    const [, neg, y, mo, w, d, h, mi, s] = iso;
    const value =
      (+(y ?? 0)) * UNIT_MS.year + (+(mo ?? 0)) * UNIT_MS.month + (+(w ?? 0)) * UNIT_MS.week + (+(d ?? 0)) * UNIT_MS.day +
      (+(h ?? 0)) * UNIT_MS.hour + (+(mi ?? 0)) * UNIT_MS.minute + (+(s ?? 0)) * UNIT_MS.second;
    return neg ? -value : value;
  }

  const re = /(-?\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let total = 0;
  let matched = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const unit = ALIASES[m[2]];
    if (!unit) return NaN;
    total += Number(m[1]) * UNIT_MS[unit];
    matched += m[0];
  }
  const leftover = text.replace(/[\s,]+|and/g, '');
  return matched && leftover === matched.replace(/\s+/g, '') ? total : NaN;
}

/**
 * Drop-in for the popular `ms` package.
 *
 * @example
 * ms('2 days')                // 172800000
 * ms(60000)                   // "1m"
 * ms(60000, { long: true })   // "1 minute"
 */
export function ms(value: string): number;
export function ms(value: number, options?: { long?: boolean; locale?: string }): string;
export function ms(value: string | number, options: { long?: boolean; locale?: string } = {}): number | string {
  if (typeof value === 'string') return parseDuration(value);
  return formatDuration(value, {
    largest: 1,
    style: options.long ? 'long' : 'narrow',
    units: ['day', 'hour', 'minute', 'second', 'millisecond'],
    locale: options.locale ?? 'en',
  }).replace(/\s(?=[a-z]+$)/i, options.long ? ' ' : '');
}
