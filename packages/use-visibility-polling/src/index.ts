import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};

/** `true` while the page is visible (Page Visibility API). */
export function usePageVisibility(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export interface PollingOptions<T> {
  /** Time between the end of one call and the start of the next, ms. @default 5000 */
  interval?: number;
  /** Start/stop polling. @default true */
  enabled?: boolean;
  /** Run immediately on mount. @default true */
  immediate?: boolean;
  /** Pause while the tab is hidden. @default true */
  pauseWhenHidden?: boolean;
  /** Pause while offline. @default true */
  pauseWhenOffline?: boolean;
  /** Fetch right away when the tab becomes visible / back online (if the data is older than `interval`). @default true */
  refetchOnResume?: boolean;
  /** Wait longer after consecutive errors: interval·2ⁿ up to this many ms. `false` to disable. @default 60000 */
  maxBackoff?: number | false;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

export interface PollingState<T> {
  data: T | undefined;
  error: unknown;
  /** First load in progress (no data yet). */
  isLoading: boolean;
  /** Any request in progress. */
  isFetching: boolean;
  /** Paused because the tab is hidden, offline, or `enabled` is false. */
  isPaused: boolean;
  lastUpdated: Date | null;
  /** Fetch now (resets the timer). */
  refresh: () => Promise<void>;
}

/**
 * Poll a function, pausing when nobody is looking.
 *
 * - Never overlaps calls: the next one starts `interval` ms after the previous finished.
 * - Passes an `AbortSignal`; pending calls are aborted on unmount / pause.
 * - Hidden tab or offline → paused; on return → refetches immediately if data is stale.
 *
 * @example
 * const { data, isPaused } = useVisibilityPolling(
 *   (signal) => fetch('/api/stats', { signal }).then((r) => r.json()),
 *   { interval: 10_000 },
 * );
 */
export function useVisibilityPolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, options: PollingOptions<T> = {}): PollingState<T> {
  const {
    interval = 5000,
    enabled = true,
    immediate = true,
    pauseWhenHidden = true,
    pauseWhenOffline = true,
    refetchOnResume = true,
  } = options;

  const visible = usePageVisibility();
  const online = useOnline();
  const paused = !enabled || (pauseWhenHidden && !visible) || (pauseWhenOffline && !online);

  const [state, setState] = useState<{ data: T | undefined; error: unknown; isFetching: boolean; lastUpdated: number | null }>({
    data: undefined,
    error: undefined,
    isFetching: false,
    lastUpdated: null,
  });

  const latest = useRef({ fetcher, options });
  latest.current = { fetcher, options };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const errors = useRef(0);
  const lastRun = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const mounted = useRef(true);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const run = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    clearTimer();
    inFlight.current = true;
    const ac = new AbortController();
    controller.current = ac;
    setState((s) => ({ ...s, isFetching: true }));
    try {
      const data = await latest.current.fetcher(ac.signal);
      if (ac.signal.aborted || !mounted.current) return;
      errors.current = 0;
      lastRun.current = Date.now();
      setState({ data, error: undefined, isFetching: false, lastUpdated: lastRun.current });
      latest.current.options.onSuccess?.(data);
    } catch (error) {
      if (ac.signal.aborted || !mounted.current) return;
      errors.current++;
      lastRun.current = Date.now();
      setState((s) => ({ ...s, error, isFetching: false }));
      latest.current.options.onError?.(error);
    } finally {
      inFlight.current = false;
      if (controller.current === ac) controller.current = null;
      if (mounted.current && !pausedRef.current && !ac.signal.aborted) schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback(() => {
    clearTimer();
    const { interval: base = 5000, maxBackoff: cap = 60_000 } = latest.current.options;
    const delay = errors.current > 0 && cap !== false ? Math.min(cap, base * 2 ** errors.current) : base;
    timer.current = setTimeout(() => void run(), delay);
  }, [run]);

  // start / pause / resume
  useEffect(() => {
    mounted.current = true;
    if (paused) {
      clearTimer();
      controller.current?.abort();
      inFlight.current = false;
      setState((s) => (s.isFetching ? { ...s, isFetching: false } : s));
      return undefined;
    }
    const age = lastRun.current === null ? Infinity : Date.now() - lastRun.current;
    if (lastRun.current === null ? immediate : refetchOnResume && age >= interval) void run();
    else {
      clearTimer();
      timer.current = setTimeout(() => void run(), Math.max(0, interval - age));
    }
    return () => clearTimer();
  }, [paused, interval, immediate, refetchOnResume, run]);

  useEffect(
    () => () => {
      mounted.current = false;
      clearTimer();
      controller.current?.abort();
    },
    [],
  );

  return {
    data: state.data,
    error: state.error,
    isLoading: state.data === undefined && state.error === undefined && (state.isFetching || (!paused && immediate && lastRun.current === null)),
    isFetching: state.isFetching,
    isPaused: paused,
    lastUpdated: state.lastUpdated === null ? null : new Date(state.lastUpdated),
    refresh: run,
  };
}

/** Alias of `useVisibilityPolling`. */
export const usePolling = useVisibilityPolling;
