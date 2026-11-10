# duration-i18n

[![npm](https://img.shields.io/npm/v/duration-i18n.svg)](https://www.npmjs.com/package/duration-i18n)
[![size](https://img.shields.io/bundlephobia/minzip/duration-i18n)](https://bundlephobia.com/package/duration-i18n)
[![license](https://img.shields.io/npm/l/duration-i18n.svg)](./LICENSE)

**Format durations and "time ago" in 100+ languages — with zero locale files.**
Uses the built-in `Intl` API (`NumberFormat` units, `ListFormat`, `RelativeTimeFormat`), so every language your browser/Node supports works out of the box with correct plurals. Also parses durations and is a drop-in for `ms`.

```ts
import { formatDuration, formatRelative, parseDuration, ms } from 'duration-i18n';

formatDuration(3_725_000);                     // "1 hour, 2 minutes"
formatDuration(3_725_000, { locale: 'uz' });   // "1 soat 2 daqiqa"
formatDuration(3_725_000, { locale: 'ru' });   // "1 час 2 минуты"
formatDuration(93_000, { style: 'narrow' });   // "1m 33s"

formatRelative(Date.now() - 180_000, { locale: 'uz' }); // "3 daqiqa oldin"
formatRelative(Date.now() - 86_400_000, { locale: 'ru' }); // "вчера"

parseDuration('1h 30m');   // 5400000
parseDuration('PT15M');    // 900000 (ISO 8601)
ms('2 days');              // 172800000
ms(60000);                 // "1m"
```

## Install

```bash
npm install duration-i18n
```

## Why

| | duration-i18n | humanize-duration | pretty-ms | ms | date-fns `formatDuration` |
| --- | --- | --- | --- | --- | --- |
| Languages | **all `Intl` locales** | ~100 bundled | English | English | per-locale imports |
| Locale data in your bundle | **0 KB** | ~30 KB | – | – | per locale |
| Relative time ("3 min ago") | ✅ | ❌ | ❌ | ❌ | separate fn |
| Parse strings / ISO 8601 | ✅ | ❌ | ❌ | ✅ / ❌ | ❌ |
| Tree-shakeable, TS types | ✅ | ❌ | ✅ | ✅ | ✅ |

## API

### `formatDuration(ms, options?)`

| Option | Default | Description |
| --- | --- | --- |
| `locale` | runtime locale | `'en'`, `'uz'`, `'ru'`, `'tr'`, `'de-DE'`, … |
| `style` | `'long'` | `'long'` → "2 hours", `'short'` → "2 hr", `'narrow'` → "2h" |
| `largest` | `2` | Max units shown |
| `units` | year → second | Allowed units: `year, month, week, day, hour, minute, second, millisecond` |
| `round` | `true` | Round the last unit (carries: 59 min 59.6 s → "1 hour") |
| `delimiter` | locale list format | Custom separator |

### `formatRelative(date, options?)`

`date`: timestamp, `Date` or ISO string. Options: `locale`, `numeric` (`'auto'` → "yesterday", `'always'` → "1 day ago"), `style`, `now`.

### `parseDuration(text)` → ms or `NaN`

`"1h 30m"`, `"1h30m"`, `"1.5 hours"`, `"2 days"`, `"1 day, 2 hours and 3 minutes"`, `"90s"`, `"250ms"`, `"500"`, `"01:02:03"`, `"2:30"`, `"PT1H30M"`, `"-5m"`.

### `ms(value)` — `ms` package compatible

`ms('2 days')` → `172800000`, `ms(60000)` → `"1m"`, `ms(60000, { long: true })` → `"1 minute"`.

### `splitDuration(ms, units?)`

`splitDuration(90_061_000)` → `{ day: 1, hour: 1, minute: 1, second: 1 }`.

## React example

```tsx
function Uptime({ startedAt }: { startedAt: number }) {
  const { i18n } = useTranslation();
  return <span>{formatDuration(Date.now() - startedAt, { locale: i18n.language })}</span>;
}
```

## Notes

- Months are 30 days and years 365.25 days.
- Needs `Intl.NumberFormat` unit support (all browsers since 2020, Node 14+ with full ICU — the default).

## License

MIT
