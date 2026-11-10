# use-throttled-stream

[![npm](https://img.shields.io/npm/v/use-throttled-stream.svg)](https://www.npmjs.com/package/use-throttled-stream)
[![size](https://img.shields.io/bundlephobia/minzip/use-throttled-stream)](https://bundlephobia.com/package/use-throttled-stream)

**Render fast WebSocket / SSE streams without freezing React.**
Calling `setState` for every message (hundreds per second) makes React re-render hundreds of times per second. This hook buffers messages and flushes them as **one batched update per interval**, with a sliding window, a "latest value" mode, or your own reducer.

```tsx
import { useThrottledStream } from 'use-throttled-stream';

function LiveTrades({ socket }: { socket: WebSocket }) {
  const { data: trades, stats } = useThrottledStream<Trade>(socket, { interval: 100, maxItems: 200 });
  return (
    <>
      <small>{stats.received} messages, {stats.flushes} renders</small>
      <TradeTable rows={trades} />
    </>
  );
}
```

## Install

```bash
npm install use-throttled-stream
```

## Sources

- **`WebSocket`, `EventSource`, `BroadcastChannel`, `Worker`** — anything with `addEventListener('message')`. String payloads are `JSON.parse`d (falls back to the raw string); override with `parse`.
- **A subscribe function** — `(emit) => unsubscribe`, e.g. Socket.IO, Firebase, MQTT:

```ts
useThrottledStream<Order>((emit) => {
  socket.on('order', emit);
  return () => socket.off('order', emit);
});
```

- **`null`** — and call `push()` yourself.

## Modes

```ts
// append (default): sliding window of the newest `maxItems`
const { data } = useThrottledStream<LogLine>(ws, { maxItems: 1000 });   // LogLine[]

// latest: only the newest message
const { data } = useThrottledStream<Price>(ws, { mode: 'latest' });     // Price | undefined

// reduce: fold each batch into state
const { data } = useThrottledStream<Tick, Record<string, Tick>>(ws, {
  mode: 'reduce',
  initialState: {},
  reducer: (state, batch) => ({ ...state, ...Object.fromEntries(batch.map((t) => [t.symbol, t])) }),
});
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `interval` | `100` | Max one flush per N ms. `0` = once per animation frame |
| `mode` | `'append'` | `'append' \| 'latest' \| 'reduce'` |
| `maxItems` | `1000` | Window size (append) |
| `reducer`, `initialState` | – | Required for `reduce` |
| `parse` | JSON with fallback | Convert `event.data` |
| `filter` | – | Drop messages |
| `enabled` | `true` | Pause listening |

Returns `{ data, push(...messages), flush(), clear(), stats: { received, flushes, lastBatch } }`.

The first message after a quiet period is shown immediately (leading edge); bursts are grouped.

## License

MIT
