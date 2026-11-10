import { useCallback, useEffect, useRef, useState } from 'react';

/** A function that starts listening, calls `emit` for every message and returns an unsubscribe function. */
export type Subscribe<T> = (emit: (message: T) => void) => (() => void) | void;

/** Something with addEventListener('message') — WebSocket, EventSource, BroadcastChannel, Worker… */
export interface MessageSource {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

interface BaseOptions<T> {
  /** Flush at most every N ms. `0` = once per animation frame. @default 100 */
  interval?: number;
  /** Turn a raw `event.data` into a message (MessageSource only). @default JSON.parse with string fallback */
  parse?: (data: unknown) => T;
  /** Ignore messages for which this returns false. */
  filter?: (message: T) => boolean;
  /** Pause listening. @default true */
  enabled?: boolean;
}

export interface AppendOptions<T> extends BaseOptions<T> {
  mode?: 'append';
  /** Keep only the newest N items. @default 1000 */
  maxItems?: number;
}

export interface LatestOptions<T> extends BaseOptions<T> {
  mode: 'latest';
}

export interface ReduceOptions<T, S> extends BaseOptions<T> {
  mode: 'reduce';
  /** Fold a batch into the state, e.g. merge price ticks by symbol. Must not mutate `state`. */
  reducer: (state: S, batch: T[]) => S;
  initialState: S;
}

export interface StreamStats {
  /** Messages received since mount / clear. */
  received: number;
  /** Number of state flushes (renders caused). */
  flushes: number;
  /** Size of the last flushed batch. */
  lastBatch: number;
}

export interface StreamControls<T> {
  /** Push messages manually (e.g. from your own socket handler). */
  push: (...messages: T[]) => void;
  /** Flush buffered messages now. */
  flush: () => void;
  /** Reset data and stats. */
  clear: () => void;
  stats: StreamStats;
}

const defaultParse = (data: unknown) => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

function cancelTimer(timer: { current: { raf: boolean; id: any } | null }) {
  const t = timer.current;
  if (!t) return;
  if (t.raf) cancelAnimationFrame(t.id);
  else clearTimeout(t.id);
  timer.current = null;
}

function isMessageSource(x: unknown): x is MessageSource {
  return !!x && typeof (x as MessageSource).addEventListener === 'function';
}

/**
 * Batch a fast stream into throttled React state.
 *
 * @example
 * // last 500 log lines, at most 10 renders per second
 * const { data: lines } = useThrottledStream<string>(socket, { maxItems: 500, interval: 100 });
 *
 * @example
 * // only the newest price
 * const { data: price } = useThrottledStream<Tick>(socket, { mode: 'latest' });
 *
 * @example
 * // merge ticks by symbol
 * const { data: bySymbol } = useThrottledStream<Tick, Record<string, Tick>>(socket, {
 *   mode: 'reduce',
 *   initialState: {},
 *   reducer: (state, batch) => ({ ...state, ...Object.fromEntries(batch.map((t) => [t.symbol, t])) }),
 * });
 */
export function useThrottledStream<T, S = never>(
  source: MessageSource | Subscribe<T> | null | undefined,
  options: ReduceOptions<T, S>,
): StreamControls<T> & { data: S };
export function useThrottledStream<T>(
  source: MessageSource | Subscribe<T> | null | undefined,
  options: LatestOptions<T>,
): StreamControls<T> & { data: T | undefined };
export function useThrottledStream<T>(
  source: MessageSource | Subscribe<T> | null | undefined,
  options?: AppendOptions<T>,
): StreamControls<T> & { data: T[] };
export function useThrottledStream<T, S>(
  source: MessageSource | Subscribe<T> | null | undefined,
  options: AppendOptions<T> | LatestOptions<T> | ReduceOptions<T, S> = {},
): StreamControls<T> & { data: unknown } {
  const opts = useRef(options);
  opts.current = options;
  const mode = options.mode ?? 'append';
  const enabled = options.enabled ?? true;

  const initial = () => (mode === 'append' ? [] : mode === 'reduce' ? (options as ReduceOptions<T, S>).initialState : undefined);
  const [data, setData] = useState<unknown>(initial);
  const [stats, setStats] = useState<StreamStats>({ received: 0, flushes: 0, lastBatch: 0 });

  const buffer = useRef<T[]>([]);
  const received = useRef(0);
  const timer = useRef<{ raf: boolean; id: any } | null>(null);
  const lastFlush = useRef(0);
  const mounted = useRef(true);

  const flush = useCallback(() => {
    cancelTimer(timer);
    const batch = buffer.current;
    if (!batch.length || !mounted.current) return;
    buffer.current = [];
    lastFlush.current = Date.now();
    const o = opts.current;

    setData((prev: unknown) => {
      if (o.mode === 'latest') return batch[batch.length - 1];
      if (o.mode === 'reduce') return (o as ReduceOptions<T, S>).reducer(prev as S, batch);
      const max = (o as AppendOptions<T>).maxItems ?? 1000;
      const next = (prev as T[]).concat(batch);
      return next.length > max ? next.slice(next.length - max) : next;
    });
    setStats((s) => ({ received: received.current, flushes: s.flushes + 1, lastBatch: batch.length }));
  }, []);

  const schedule = useCallback(() => {
    if (timer.current !== null) return;
    const ms = opts.current.interval ?? 100;
    if (ms === 0 && typeof requestAnimationFrame === 'function') {
      timer.current = { raf: true, id: requestAnimationFrame(() => flush()) };
      return;
    }
    // leading edge: flush right away if the last flush is older than the interval
    const wait = Math.max(0, lastFlush.current + ms - Date.now());
    timer.current = { raf: false, id: setTimeout(flush, wait) };
  }, [flush]);

  const push = useCallback(
    (...messages: T[]) => {
      const filter = opts.current.filter;
      for (const m of messages) {
        if (filter && !filter(m)) continue;
        buffer.current.push(m);
        received.current++;
      }
      if (buffer.current.length) schedule();
    },
    [schedule],
  );

  const clear = useCallback(() => {
    buffer.current = [];
    received.current = 0;
    const o = opts.current;
    setData(o.mode === 'append' || !o.mode ? [] : o.mode === 'reduce' ? (o as ReduceOptions<T, S>).initialState : undefined);
    setStats({ received: 0, flushes: 0, lastBatch: 0 });
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!source || !enabled) return undefined;
    if (isMessageSource(source)) {
      const listener = (event: { data: unknown }) => {
        const parse = opts.current.parse ?? (defaultParse as (d: unknown) => T);
        push(parse(event.data));
      };
      source.addEventListener('message', listener);
      return () => source.removeEventListener('message', listener);
    }
    const unsubscribe = source((m) => push(m));
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [source, enabled, push]);

  useEffect(
    () => () => {
      mounted.current = false;
      cancelTimer(timer);
    },
    [],
  );

  return { data, push, flush, clear, stats };
}
