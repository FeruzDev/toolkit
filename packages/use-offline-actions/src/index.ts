import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface QueuedAction<P = unknown> {
  id: string;
  /** Your action type, e.g. `'createOrder'`. */
  type: string;
  payload: P;
  createdAt: number;
  attempts: number;
  /** Last error message, if any. */
  error?: string;
  /** `pending` = waiting/retrying, `failed` = gave up (permanent error or max attempts). */
  status: 'pending' | 'failed';
  nextAttemptAt?: number;
}

/** Throw this from the handler to stop retrying an action (e.g. HTTP 400/422). */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export interface OfflineQueueOptions<P> {
  /** Storage key; also identifies the queue across tabs. @default 'offline-queue' */
  key?: string;
  /** Sends one action to the server. Throw to retry later; throw `PermanentError` to give up. */
  handler: (action: QueuedAction<P>) => Promise<unknown>;
  /** Max attempts before an action becomes `failed`. @default 5 */
  maxAttempts?: number;
  /** Delay before retry N (ms). @default exponential 1s·2ⁿ, max 60s */
  retryDelay?: (attempt: number) => number;
  /** Storage to persist the queue. `null` = memory only. @default window.localStorage */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Called after an action was sent successfully. */
  onSuccess?: (action: QueuedAction<P>, result: unknown) => void;
  /** Called when an action fails permanently. */
  onFailure?: (action: QueuedAction<P>, error: unknown) => void;
}

export interface OfflineQueue<P> {
  /** Add an action. It is sent immediately when online, otherwise when the connection returns. */
  enqueue: (type: string, payload: P) => QueuedAction<P>;
  /** Actions waiting to be sent. */
  pending: QueuedAction<P>[];
  /** Actions that gave up. Use `retry(id)` or `remove(id)`. */
  failed: QueuedAction<P>[];
  isOnline: boolean;
  isSyncing: boolean;
  /** Try to send everything now. */
  sync: () => Promise<void>;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** `navigator.onLine` as React state. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const defaultDelay = (attempt: number) => Math.min(60_000, 1000 * 2 ** (attempt - 1));

// Only one processor per queue key: in this tab (Set) and across tabs (Web Locks API when available).
const localLocks = new Set<string>();
async function withQueueLock(key: string, fn: () => Promise<void>): Promise<void> {
  if (localLocks.has(key)) return;
  localLocks.add(key);
  try {
    const locks = (typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined);
    if (locks?.request) {
      await locks.request(`offline-queue:${key}`, { ifAvailable: true }, async (lock) => {
        if (lock) await fn();
      });
    } else {
      await fn();
    }
  } finally {
    localLocks.delete(key);
  }
}

/**
 * Offline-first outbox: actions are stored and sent in order when online.
 *
 * @example
 * const queue = useOfflineQueue<NewOrder>({
 *   key: 'orders-outbox',
 *   handler: (action) => api.post('/orders', action.payload),
 * });
 *
 * queue.enqueue('createOrder', { productId: 7, qty: 2 });
 * {queue.pending.length > 0 && <Badge>{queue.pending.length} waiting to sync</Badge>}
 */
export function useOfflineQueue<P = unknown>(options: OfflineQueueOptions<P>): OfflineQueue<P> {
  const key = options.key ?? 'offline-queue';
  const storage = options.storage === undefined ? (typeof window !== 'undefined' ? window.localStorage : null) : options.storage;
  const opts = useRef(options);
  opts.current = options;

  const read = useCallback((): QueuedAction<P>[] => {
    try {
      const raw = storage?.getItem(key);
      return raw ? (JSON.parse(raw) as QueuedAction<P>[]) : [];
    } catch {
      return [];
    }
  }, [key, storage]);

  const [items, setItemsState] = useState<QueuedAction<P>[]>(read);
  const itemsRef = useRef(items);
  const isOnline = useOnlineStatus();
  const [isSyncing, setSyncing] = useState(false);
  const syncing = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setItems = useCallback(
    (update: (prev: QueuedAction<P>[]) => QueuedAction<P>[]) => {
      const next = update(itemsRef.current);
      itemsRef.current = next;
      setItemsState(next);
      try {
        storage?.setItem(key, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
    },
    [key, storage],
  );

  // other tabs changed the queue
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        const next = read();
        itemsRef.current = next;
        setItemsState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, read]);

  const mounted = useRef(true);

  const rerun = useRef(false);

  const sync = useCallback(async () => {
    if (!mounted.current || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    if (syncing.current) {
      // a sync is running: make sure it runs once more so newly added actions are not missed
      rerun.current = true;
      return;
    }
    syncing.current = true;
    setSyncing(true);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    try {
      await withQueueLock(key, async () => {
      // process in order; stop at the first retryable error to keep ordering
      for (;;) {
        if (!mounted.current) break;
        if (storage) {
          // another tab/instance may have changed the queue
          const fresh = read();
          itemsRef.current = fresh;
          setItemsState(fresh);
        }
        const now = Date.now();
        const action = itemsRef.current.find((a) => a.status === 'pending');
        if (!action) break;
        if (action.nextAttemptAt && action.nextAttemptAt > now) {
          retryTimer.current = setTimeout(() => void syncRef.current(), action.nextAttemptAt - now);
          break;
        }
        const attempt = { ...action, attempts: action.attempts + 1 };
        try {
          const result = await opts.current.handler(attempt);
          setItems((prev) => prev.filter((a) => a.id !== action.id));
          opts.current.onSuccess?.(attempt, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const max = opts.current.maxAttempts ?? 5;
          const permanent = error instanceof PermanentError || (error as { name?: string })?.name === 'PermanentError';
          if (permanent || attempt.attempts >= max) {
            const failed: QueuedAction<P> = { ...attempt, status: 'failed', error: message, nextAttemptAt: undefined };
            setItems((prev) => prev.map((a) => (a.id === action.id ? failed : a)));
            opts.current.onFailure?.(failed, error);
            continue; // a permanent failure should not block the rest
          }
          const delay = (opts.current.retryDelay ?? defaultDelay)(attempt.attempts);
          setItems((prev) => prev.map((a) => (a.id === action.id ? { ...attempt, error: message, nextAttemptAt: Date.now() + delay } : a)));
          retryTimer.current = setTimeout(() => void syncRef.current(), delay);
          break;
        }
      }
      });
    } finally {
      syncing.current = false;
      if (mounted.current) setSyncing(false);
      if (rerun.current && mounted.current) {
        rerun.current = false;
        queueMicrotask(() => void syncRef.current());
      }
    }
  }, [setItems, key, storage, read]);

  const syncRef = useRef(sync);
  syncRef.current = sync;

  // sync on mount and whenever we come back online
  useEffect(() => {
    if (isOnline) void sync();
  }, [isOnline, sync]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const enqueue = useCallback(
    (type: string, payload: P) => {
      const action: QueuedAction<P> = { id: uid(), type, payload, createdAt: Date.now(), attempts: 0, status: 'pending' };
      setItems((prev) => [...prev, action]);
      queueMicrotask(() => void syncRef.current());
      return action;
    },
    [setItems],
  );

  const retry = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'pending', attempts: 0, error: undefined, nextAttemptAt: undefined } : a)));
      queueMicrotask(() => void syncRef.current());
    },
    [setItems],
  );

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((a) => a.id !== id)), [setItems]);
  const clear = useCallback(() => setItems(() => []), [setItems]);

  return {
    enqueue,
    pending: items.filter((a) => a.status === 'pending'),
    failed: items.filter((a) => a.status === 'failed'),
    isOnline,
    isSyncing,
    sync,
    retry,
    remove,
    clear,
  };
}

/** Alias of `useOfflineQueue`. */
export const useOfflineActions = useOfflineQueue;
