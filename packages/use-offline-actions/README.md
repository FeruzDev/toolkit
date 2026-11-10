# use-offline-actions

[![npm](https://img.shields.io/npm/v/use-offline-actions.svg)](https://www.npmjs.com/package/use-offline-actions)
[![size](https://img.shields.io/bundlephobia/minzip/use-offline-actions)](https://bundlephobia.com/package/use-offline-actions)

**Offline-first actions in one React hook.** Users keep working without internet; their actions are saved (localStorage), and sent **in order** as soon as the connection is back — with retries, backoff, permanent-failure handling and protection against double sending across components and tabs.

```tsx
import { useOfflineQueue, PermanentError } from 'use-offline-actions';

function OrderForm() {
  const outbox = useOfflineQueue<NewOrder>({
    key: 'orders-outbox',
    handler: async (action) => {
      const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(action.payload) });
      if (res.status === 422) throw new PermanentError('Invalid order'); // don't retry
      if (!res.ok) throw new Error(`HTTP ${res.status}`);               // retry later
    },
  });

  return (
    <>
      {!outbox.isOnline && <Banner>Offline — orders will be sent automatically</Banner>}
      {outbox.pending.length > 0 && <Badge>{outbox.pending.length} waiting to sync</Badge>}
      <button onClick={() => outbox.enqueue('createOrder', { productId: 7, qty: 2 })}>Order</button>
      {outbox.failed.map((a) => (
        <p key={a.id}>
          Failed: {a.error} <button onClick={() => outbox.retry(a.id)}>Retry</button>
          <button onClick={() => outbox.remove(a.id)}>Discard</button>
        </p>
      ))}
    </>
  );
}
```

## Install

```bash
npm install use-offline-actions
```

## Behaviour

- **Persisted**: survives reloads and closed tabs (`localStorage`, or your own `storage`, or `null` for memory).
- **In order**: actions are sent one by one; a retryable error pauses the queue (later actions wait) so the server sees them in the original order.
- **Retries**: exponential backoff (1 s, 2 s, 4 s … max 60 s), `maxAttempts` (default 5), then `failed`.
- **Permanent errors**: throw `PermanentError` (validation errors, 4xx) to skip retries; the queue continues.
- **No double sending**: one processor per queue key — Web Locks API across tabs, an in-memory lock inside a tab, and the queue is re-read from storage before each send.
- **Auto sync**: on mount, on `online` events, after `enqueue`, and on retry timers.

## API

`useOfflineQueue<P>(options)` (alias `useOfflineActions`)

| Option | Default | Description |
| --- | --- | --- |
| `handler(action)` | required | Send one action; throw to retry, throw `PermanentError` to fail |
| `key` | `'offline-queue'` | Storage key / queue identity |
| `maxAttempts` | `5` | Attempts before `failed` |
| `retryDelay(attempt)` | `1000·2ⁿ` (max 60 s) | Backoff |
| `storage` | `localStorage` | `{ getItem, setItem }` or `null` |
| `onSuccess(action, result)`, `onFailure(action, error)` | – | Callbacks |

Returns `{ enqueue(type, payload), pending, failed, isOnline, isSyncing, sync(), retry(id), remove(id), clear() }`.

Each action: `{ id, type, payload, createdAt, attempts, status, error?, nextAttemptAt? }` — `id` is a UUID you can send as an **idempotency key** so the server can ignore duplicates.

Also exported: `useOnlineStatus()` → `boolean`.

## Tip

Use one `useOfflineQueue` per key (e.g. inside a context provider) and read its state from there.

## License

MIT
