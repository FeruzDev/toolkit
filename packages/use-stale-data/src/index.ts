import { useCallback, useEffect, useRef, useState } from 'react';

export type Freshness = 'fresh' | 'warning' | 'stale' | 'unknown';

export interface UseStaleDataOptions {
  /** Data becomes `stale` this many ms after the last update. @default 60000 */
  staleAfter?: number;
  /** Optional earlier threshold for a `warning` status (ms). */
  warnAfter?: number;
  /**
   * Re-render every N ms to keep `age` live (e.g. for "updated 12 s ago").
   * `0` = only re-render when the status changes (cheapest). @default 0
   */
  tick?: number;
  /** Called once when data becomes stale. */
  onStale?: (age: number) => void;
  /** Called when fresh data arrives after being stale. */
  onFresh?: () => void;
  /** Disable checks (e.g. while loading). @default true */
  enabled?: boolean;
}

export interface StaleDataState {
  status: Freshness;
  isStale: boolean;
  isWarning: boolean;
  /** Milliseconds since the last update (`null` if never updated). */
  age: number | null;
  /** Time of the last update. */
  updatedAt: Date | null;
  /** Mark data as fresh now (e.g. after a manual refresh or a heartbeat message). */
  touch: () => void;
}

/**
 * Track data freshness.
 *
 * Pass either `updatedAt` (timestamp / Date — e.g. React Query's `dataUpdatedAt`)
 * or any `data` value: when it changes (by reference) the clock restarts.
 *
 * @example
 * const { isStale, age } = useStaleData({ updatedAt: query.dataUpdatedAt }, { staleAfter: 30_000, tick: 1000 });
 * {isStale && <Banner>Data is {Math.round(age! / 1000)} s old</Banner>}
 *
 * @example
 * // WebSocket feed: restart the clock on every message
 * const { status } = useStaleData({ data: lastMessage }, { warnAfter: 5000, staleAfter: 15000 });
 */
export function useStaleData(
  source: { updatedAt?: number | Date | null; data?: unknown },
  options: UseStaleDataOptions = {},
): StaleDataState {
  const { staleAfter = 60_000, warnAfter, tick = 0, enabled = true } = options;
  const callbacks = useRef(options);
  callbacks.current = options;

  const [dataTime, setDataTime] = useState<number | null>(() => ('data' in source && source.data !== undefined ? Date.now() : null));
  const [touchedAt, setTouchedAt] = useState<number | null>(null);
  const [, force] = useState(0);
  const prevData = useRef(source.data);

  // restart the clock whenever `data` changes
  useEffect(() => {
    if (!('data' in source)) return;
    if (!Object.is(prevData.current, source.data)) {
      prevData.current = source.data;
      if (source.data !== undefined) setDataTime(Date.now());
    }
  }, [source.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const explicit = source.updatedAt == null ? null : typeof source.updatedAt === 'number' ? source.updatedAt : source.updatedAt.getTime();
  const candidates = [explicit, dataTime, touchedAt].filter((t): t is number => typeof t === 'number' && t > 0);
  const last = candidates.length ? Math.max(...candidates) : null;

  const now = Date.now();
  const age = last === null ? null : Math.max(0, now - last);
  const status: Freshness =
    !enabled || age === null ? 'unknown' : age >= staleAfter ? 'stale' : warnAfter !== undefined && age >= warnAfter ? 'warning' : 'fresh';

  // schedule the next re-render: at the next threshold, or every `tick`
  useEffect(() => {
    if (!enabled || last === null) return undefined;
    const thresholds = [warnAfter, staleAfter].filter((t): t is number => t !== undefined).map((t) => last + t - Date.now()).filter((ms) => ms > 0);
    const next = Math.min(...thresholds, tick > 0 ? tick : Infinity);
    if (!Number.isFinite(next)) return undefined;
    const id = setTimeout(() => force((n) => n + 1), next + 5);
    return () => clearTimeout(id);
  });

  // callbacks on transitions
  const prevStatus = useRef<Freshness>(status);
  useEffect(() => {
    const before = prevStatus.current;
    prevStatus.current = status;
    if (status === 'stale' && before !== 'stale') callbacks.current.onStale?.(age ?? 0);
    if (before === 'stale' && (status === 'fresh' || status === 'warning')) callbacks.current.onFresh?.();
  }, [status, age]);

  const touch = useCallback(() => setTouchedAt(Date.now()), []);

  return {
    status,
    isStale: status === 'stale',
    isWarning: status === 'warning',
    age,
    updatedAt: last === null ? null : new Date(last),
    touch,
  };
}
