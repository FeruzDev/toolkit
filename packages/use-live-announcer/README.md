# use-live-announcer

[![npm](https://img.shields.io/npm/v/use-live-announcer.svg)](https://www.npmjs.com/package/use-live-announcer)
[![size](https://img.shields.io/bundlephobia/minzip/use-live-announcer)](https://bundlephobia.com/package/use-live-announcer)
[![license](https://img.shields.io/npm/l/use-live-announcer.svg)](./LICENSE)

**Make dashboards accessible: announce alarms and important changes to screen readers with `aria-live`.**
Tiny (< 1 KB), zero dependencies, works in React and vanilla JS, SSR-safe.

Sighted users see a red badge appear. Screen-reader users hear nothing — unless you announce it. Almost no dashboard does this; with this package it is one line.

```tsx
useAnnounceOnChange(alarms.length, (n) => `${n} active alarms`, { politeness: 'assertive' });
```

## Install

```bash
npm install use-live-announcer
```

## Usage

### Announce on demand

```tsx
import { useLiveAnnouncer } from 'use-live-announcer';

function SaveButton() {
  const { announcePolite } = useLiveAnnouncer();
  return <button onClick={async () => { await save(); announcePolite('Changes saved'); }}>Save</button>;
}
```

### Announce when a value changes (dashboards, monitoring, live data)

```tsx
import { useAnnounceOnChange } from 'use-live-announcer';

function AlarmPanel({ alarms }: { alarms: Alarm[] }) {
  useAnnounceOnChange(
    alarms.length,
    (count, prev) => `${count - (prev ?? 0)} new alarms. ${count} active in total.`,
    {
      politeness: 'assertive',              // interrupt: this is urgent
      when: (count, prev) => count > (prev ?? 0), // only when alarms increase
      throttle: 2000,                       // merge bursts into one announcement
    },
  );
  return <AlarmList alarms={alarms} />;
}
```

### Without React

```ts
import { announce } from 'use-live-announcer';

announce('Upload complete');
announce('Connection lost!', { politeness: 'assertive' });
```

## API

| Export | Description |
| --- | --- |
| `announce(message, { politeness?, clearAfter? })` | Announce from anywhere. `politeness`: `'polite'` (default) or `'assertive'`. Text is cleared after `clearAfter` ms (default 7000). |
| `useLiveAnnouncer()` | `{ announce, announcePolite, announceAssertive }` — stable callbacks. |
| `useAnnounceOnChange(value, format, options?)` | Announces `format(value, previous)` when `value` changes. Options: `politeness`, `announceInitial` (false), `throttle` (1000 ms), `when(value, previous)`. Return `null` from `format` to skip. |
| `resetAnnouncer()` | Remove live regions and timers (tests). |

## How it works / best practices

- Two visually hidden regions are added to `<body>` once: `role="status" aria-live="polite"` and `role="alert" aria-live="assertive"`. They exist before content changes, which screen readers require.
- The region is cleared and filled on the next tick, so **repeating the same message is announced again**.
- Use **polite** for status ("Saved", "5 results"), **assertive** only for urgent things (alarms, errors, lost connection).
- Keep messages short and meaningful: "3 new critical alarms" beats "Data updated".
- Throttle noisy streams; screen-reader users cannot listen to 10 updates per second.

Meets WCAG 2.2 **4.1.3 Status Messages**.

## Alternatives

| | use-live-announcer | react-aria-live | @react-aria/live-announcer |
| --- | --- | --- | --- |
| Vanilla JS | ✅ | ❌ | ✅ |
| Announce-on-change hook with throttle & filter | ✅ | ❌ | ❌ |
| Provider required | ❌ | ✅ | ❌ |

## License

MIT
