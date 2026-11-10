# use-stale-data

[![npm](https://img.shields.io/npm/v/use-stale-data.svg)](https://www.npmjs.com/package/use-stale-data)
[![size](https://img.shields.io/bundlephobia/minzip/use-stale-data)](https://bundlephobia.com/package/use-stale-data)

**Know when the data on screen is out of date.** A tiny React hook that turns "last updated" into a status — `fresh`, `warning`, `stale` — with a live age, so dashboards can say *"Data is 2 minutes old"* instead of silently showing old numbers.

```tsx
import { useStaleData } from 'use-stale-data';

function Prices() {
  const query = useQuery({ queryKey: ['prices'], queryFn: fetchPrices, refetchInterval: 10_000 });
  const { status, age } = useStaleData({ updatedAt: query.dataUpdatedAt }, { warnAfter: 20_000, staleAfter: 60_000, tick: 1000 });

  return (
    <>
      {status === 'warning' && <Badge color="yellow">Updated {Math.round(age! / 1000)} s ago</Badge>}
      {status === 'stale' && <Banner color="red">Prices may be outdated — connection problem?</Banner>}
      <PriceTable data={query.data} />
    </>
  );
}
```

## Install

```bash
npm install use-stale-data
```

## Sources of "last updated"

```ts
useStaleData({ updatedAt: query.dataUpdatedAt });      // React Query
useStaleData({ updatedAt: lastFetchedAt });            // your own timestamp / Date
useStaleData({ data: swr.data });                      // any value — clock restarts when it changes
useStaleData({ data: lastWebSocketMessage });          // live feeds
```

## API

`useStaleData(source, options?)`

| Option | Default | Description |
| --- | --- | --- |
| `staleAfter` | `60000` | ms until `stale` |
| `warnAfter` | – | ms until `warning` (optional earlier stage) |
| `tick` | `0` | Re-render every N ms to keep `age` live. `0` = only re-render when status changes |
| `onStale(age)` | – | Called once when data turns stale (e.g. show a toast, force refetch) |
| `onFresh()` | – | Called when fresh data arrives after being stale |
| `enabled` | `true` | `false` → status `unknown` |

Returns `{ status, isStale, isWarning, age, updatedAt, touch }`. `touch()` marks data fresh now (manual refresh, heartbeat).

Efficient by default: without `tick`, the hook sets a single timer for the next threshold instead of re-rendering every second.

## License

MIT
