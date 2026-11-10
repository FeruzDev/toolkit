# use-visibility-polling

[![npm](https://img.shields.io/npm/v/use-visibility-polling.svg)](https://www.npmjs.com/package/use-visibility-polling)
[![size](https://img.shields.io/bundlephobia/minzip/use-visibility-polling)](https://bundlephobia.com/package/use-visibility-polling)

**Polling that stops when nobody is looking.** `setInterval(fetch, 5000)` keeps hammering your API from every forgotten background tab. This hook pauses while the tab is hidden or offline, refetches immediately when the user comes back, never overlaps requests, aborts stale ones and backs off on errors.

```tsx
import { useVisibilityPolling } from 'use-visibility-polling';

function ServerStats() {
  const { data, error, isPaused, lastUpdated, refresh } = useVisibilityPolling(
    (signal) => fetch('/api/stats', { signal }).then((r) => r.json()),
    { interval: 10_000 },
  );

  return (
    <section>
      <Stats data={data} />
      <small>
        {isPaused ? 'Paused' : `Updated ${lastUpdated?.toLocaleTimeString()}`}
        <button onClick={refresh}>Refresh</button>
      </small>
      {error && <p>Failed to load, retrying…</p>}
    </section>
  );
}
```

## Install

```bash
npm install use-visibility-polling
```

## Behaviour

| Situation | What happens |
| --- | --- |
| Tab hidden / minimized | Timer cleared, in-flight request aborted |
| Tab visible again | Fetch **immediately** if data is older than `interval`, then resume |
| Offline → online | Same as above |
| Slow request | Next call starts `interval` ms **after** it finishes — never overlapping |
| Errors | Backoff: `interval·2ⁿ` up to `maxBackoff` (default 60 s); resets on success |
| Unmount | Timer cleared, request aborted, no state updates |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `interval` | `5000` | ms between calls |
| `enabled` | `true` | Start/stop |
| `immediate` | `true` | Fetch on mount |
| `pauseWhenHidden` | `true` | Use the Page Visibility API |
| `pauseWhenOffline` | `true` | Use `navigator.onLine` |
| `refetchOnResume` | `true` | Fetch right away on return if stale |
| `maxBackoff` | `60000` | Error backoff cap, `false` to disable |
| `onSuccess(data)`, `onError(error)` | – | Callbacks |

Returns `{ data, error, isLoading, isFetching, isPaused, lastUpdated, refresh() }`. Alias: `usePolling`. Also exported: `usePageVisibility()`.

### With React Query?

React Query already has `refetchInterval` + `refetchIntervalInBackground: false`. Use this hook when you don't use a data-fetching library, or for non-HTTP polling (device status, local APIs, SDK calls).

## License

MIT
