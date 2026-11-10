# temporal-dates

[![npm](https://img.shields.io/npm/v/temporal-dates.svg)](https://www.npmjs.com/package/temporal-dates)
[![size](https://img.shields.io/bundlephobia/minzip/temporal-dates)](https://bundlephobia.com/package/temporal-dates)
[![license](https://img.shields.io/npm/l/temporal-dates.svg)](./LICENSE)

**date-fns-style helpers built on the [Temporal API](https://tc39.es/proposal-temporal/docs/).**
`Temporal` is the new standard date/time API landing in JavaScript engines. This package gives it the friendly, function-based API you know from date-fns — and it also accepts plain `Date`s, so you can migrate gradually.

- 🔁 **Same type in, same type out**: `Date` → `Date`, `PlainDate` → `PlainDate`, `ZonedDateTime` → `ZonedDateTime`
- 🌍 Real time zones (IANA), DST-safe arithmetic, calendar-correct month math
- 🧩 Uses native `Temporal` when available, otherwise any polyfill — no lock-in
- 🪶 Tiny, tree-shakeable, zero runtime dependencies

```ts
import { add, startOf, diff, format, today, now } from 'temporal-dates';

add(today(), { days: 3 });                       // Temporal.PlainDate
add(new Date(), { months: 1 });                  // Date (yes, plain Dates work)
startOf(now('Asia/Tashkent'), 'week');           // Monday 00:00 in Tashkent
diff('2026-03-01', '2026-01-15', 'day');         // 45
format(now(), 'yyyy-MM-dd HH:mm');               // "2026-11-10 14:05"
format(today(), 'd MMMM yyyy', { locale: 'uz' }); // "10 noyabr 2026"
```

## Install

```bash
npm install temporal-dates
```

Until every runtime ships `Temporal` natively, add a polyfill once at app start:

```bash
npm install temporal-polyfill
```

```ts
import 'temporal-polyfill/global'; // in main.ts / index.ts
```

or without touching globals:

```ts
import { Temporal } from 'temporal-polyfill';
import { setTemporal } from 'temporal-dates';
setTemporal(Temporal);
```

When the runtime has native `Temporal`, just remove the polyfill — nothing else changes.

## API

**Inputs** (`DateInput`): `Temporal.PlainDate | PlainDateTime | ZonedDateTime | Instant | Date | string (ISO 8601) | number (epoch ms)`. Functions that return a date return **the same type** as the input (strings/numbers become `ZonedDateTime`). Options accept `timeZone` (IANA name) for `Date`/number/Instant inputs.

| Function | Example |
| --- | --- |
| `now(tz?)`, `today(tz?)` | `now('Europe/Moscow')` |
| `parse(iso)` | `'2026-03-05'` → PlainDate, `'2026-03-05T10:00'` → PlainDateTime, with `Z`/offset/`[Zone]` → ZonedDateTime |
| `add(v, duration)`, `subtract(v, duration)` | `add(d, { months: 1, days: 2 })` — Jan 31 + 1 month = Feb 28 |
| `startOf(v, unit, { weekStartsOn })`, `endOf(v, unit)` | units: `year month week day hour minute second` |
| `diff(a, b, unit)` | whole units, truncated (date-fns `differenceInX`) |
| `compare(a, b)` | `dates.sort(compare)` |
| `isBefore`, `isAfter`, `isEqual`, `isSame(a, b, unit)`, `isBetween(v, start, end, inclusive?)` | |
| `isToday`, `isWeekend`, `isLeapYear`, `daysInMonth` | |
| `min(...)`, `max(...)`, `clamp(v, lo, hi)` | |
| `eachDay(start, end)` | `PlainDate[]`, inclusive |
| `inTimeZone(v, tz)` | same instant, other zone |
| `toZoned`, `toPlainDate`, `toDate`, `toEpochMs` | conversions |
| `format(v, pattern, { locale, timeZone })` | tokens `yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm m ss s SSS a xxx`, `'literal'` |
| `formatIntl(v, Intl options, locale)` | `formatIntl(d, { dateStyle: 'long' }, 'ru')` |
| `setTemporal(impl)`, `getTemporal()` | choose implementation |

## Migrating from date-fns

| date-fns | temporal-dates |
| --- | --- |
| `addDays(d, 3)` | `add(d, { days: 3 })` |
| `subMonths(d, 1)` | `subtract(d, { months: 1 })` |
| `startOfWeek(d, { weekStartsOn: 1 })` | `startOf(d, 'week', { weekStartsOn: 1 })` |
| `differenceInDays(a, b)` | `diff(a, b, 'day')` |
| `isSameDay(a, b)` | `isSame(a, b, 'day')` |
| `format(d, 'yyyy-MM-dd')` | `format(d, 'yyyy-MM-dd')` |
| `formatInTimeZone(d, tz, fmt)` | `format(d, fmt, { timeZone: tz })` |
| `eachDayOfInterval({ start, end })` | `eachDay(start, end)` |

## Why Temporal?

`Date` has no time zones (only local/UTC), mutable objects, 0-based months and no calendar-date type. Temporal fixes all of that: `PlainDate` for birthdays, `ZonedDateTime` for meetings across time zones, `Instant` for timestamps, immutable values and correct DST handling.

## License

MIT
