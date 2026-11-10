import { useCallback, useEffect, useRef, useState } from 'react';

export type IdleStatus = 'active' | 'warning' | 'idle';

export interface IdleTimerOptions {
  /** Inactivity time until `idle`, ms. @default 900000 (15 min) */
  timeout?: number;
  /** Show the warning this many ms before `idle`. `0` = no warning stage. @default 60000 */
  warningBefore?: number;
  /** DOM events that count as activity. */
  events?: string[];
  /** Share activity between tabs of the same site (localStorage + BroadcastChannel). @default true */
  crossTab?: boolean;
  /** Key used for cross-tab sync. @default 'idle-timer' */
  storageKey?: string;
  /** Activity events are processed at most once per N ms. @default 500 */
  throttle?: number;
  /** Turn the timer off (e.g. when logged out). @default true */
  enabled?: boolean;
  /** Called when the warning stage starts. */
  onWarn?: (remaining: number) => void;
  /** Called once when the user becomes idle. */
  onIdle?: () => void;
  /** Called when the user becomes active again after warning/idle. */
  onActive?: () => void;
}

export interface IdleTimerState {
  status: IdleStatus;
  isIdle: boolean;
  isWarning: boolean;
  /** ms until idle (updates every second during the warning). */
  remaining: number;
  lastActive: Date;
  /** Count as activity now (e.g. "Stay signed in" button). */
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll', 'pointerdown'];

/**
 * Track user inactivity with an optional warning stage.
 *
 * @example
 * const { isWarning, remaining, reset } = useIdleTimer({
 *   timeout: 10 * 60_000,
 *   warningBefore: 60_000,
 *   onIdle: () => logout(),
 * });
 */
export function useIdleTimer(options: IdleTimerOptions = {}): IdleTimerState {
  const {
    timeout = 15 * 60_000,
    warningBefore = 60_000,
    events = DEFAULT_EVENTS,
    crossTab = true,
    storageKey = 'idle-timer',
    throttle = 500,
    enabled = true,
  } = options;
  const callbacks = useRef(options);
  callbacks.current = options;

  const lastActive = useRef(Date.now());
  const [paused, setPaused] = useState(false);
  const [, force] = useState(0);
  const statusRef = useRef<IdleStatus>('active');
  const channel = useRef<BroadcastChannel | null>(null);
  const lastEvent = useRef(0);

  const computeStatus = (now: number): IdleStatus => {
    const idleAt = lastActive.current + timeout;
    if (now >= idleAt) return 'idle';
    if (warningBefore > 0 && now >= idleAt - warningBefore) return 'warning';
    return 'active';
  };

  const evaluate = useCallback(() => {
    const now = Date.now();
    const next = !enabled || paused ? 'active' : computeStatus(now);
    const prev = statusRef.current;
    if (next !== prev) {
      statusRef.current = next;
      if (next === 'warning') callbacks.current.onWarn?.(lastActive.current + timeout - now);
      if (next === 'idle') callbacks.current.onIdle?.();
      if (next === 'active' && prev !== 'active') callbacks.current.onActive?.();
    }
    force((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, timeout, warningBefore]);

  const markActive = useCallback(
    (at: number, broadcast: boolean) => {
      if (at <= lastActive.current) return;
      lastActive.current = at;
      if (broadcast && crossTab) {
        try {
          localStorage.setItem(storageKey, String(at));
        } catch {
          /* ignore */
        }
        channel.current?.postMessage(at);
      }
      evaluate();
    },
    [crossTab, storageKey, evaluate],
  );

  const reset = useCallback(() => markActive(Date.now(), true), [markActive]);

  // activity listeners
  useEffect(() => {
    if (!enabled || paused || typeof window === 'undefined') return undefined;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastEvent.current < throttle) return;
      lastEvent.current = now;
      // once idle, only an explicit reset() brings the user back (avoids flicker before redirect)
      if (statusRef.current === 'idle') return;
      markActive(now, true);
    };
    const onVisible = () => document.visibilityState === 'visible' && evaluate();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, paused, throttle, markActive, evaluate, events.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // cross-tab sync
  useEffect(() => {
    if (!enabled || !crossTab || typeof window === 'undefined') return undefined;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue && statusRef.current !== 'idle') markActive(Number(e.newValue), false);
    };
    window.addEventListener('storage', onStorage);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel(storageKey);
      channel.current.onmessage = (e) => {
        if (statusRef.current !== 'idle') markActive(Number(e.data), false);
      };
    }
    return () => {
      window.removeEventListener('storage', onStorage);
      channel.current?.close();
      channel.current = null;
    };
  }, [enabled, crossTab, storageKey, markActive]);

  // One light interval: re-render only when the status changes, or every tick during the warning countdown.
  // Timestamps (not timer counts) decide the status, so throttled background tabs stay correct.
  const status = !enabled || paused ? 'active' : computeStatus(Date.now());
  useEffect(() => {
    if (!enabled || paused) return undefined;
    const every = Math.max(50, Math.min(1000, Math.floor(timeout / 20)));
    const id = setInterval(() => {
      const next = computeStatus(Date.now());
      if (next !== statusRef.current || next === 'warning') evaluate();
    }, every);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, timeout, warningBefore, evaluate]);

  // initial / option changes
  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const remaining = Math.max(0, lastActive.current + timeout - Date.now());
  return {
    status,
    isIdle: status === 'idle',
    isWarning: status === 'warning',
    remaining: status === 'active' && (!enabled || paused) ? timeout : remaining,
    lastActive: new Date(lastActive.current),
    reset,
    pause: useCallback(() => setPaused(true), []),
    resume: useCallback(() => {
      lastActive.current = Date.now();
      setPaused(false);
    }, []),
  };
}

export interface IdleRedirectOptions extends Omit<IdleTimerOptions, 'onIdle'> {
  /** Where to go when idle. @default '/login' */
  redirectTo?: string;
  /** Append `?reason=idle&returnTo=<current path>` to `redirectTo`. @default true */
  withReturnTo?: boolean;
  /** Runs before redirecting (call your logout API, clear tokens…). */
  onIdle?: () => void | Promise<void>;
  /** Custom navigation (React Router `navigate`, Next `router.replace`). @default window.location.assign */
  navigate?: (url: string) => void;
}

/** Build the redirect URL used by `useIdleRedirect`. */
export function buildIdleRedirectUrl(redirectTo: string, withReturnTo = true): string {
  if (!withReturnTo || typeof window === 'undefined') return redirectTo;
  const url = new URL(redirectTo, window.location.origin);
  url.searchParams.set('reason', 'idle');
  url.searchParams.set('returnTo', window.location.pathname + window.location.search);
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : url.toString();
}

/**
 * Log out and redirect after inactivity, with a warning stage you can render as a dialog.
 *
 * @example
 * function SessionGuard() {
 *   const { isWarning, remaining, reset } = useIdleRedirect({
 *     timeout: 15 * 60_000,
 *     warningBefore: 60_000,
 *     onIdle: () => api.post('/logout'),
 *     redirectTo: '/login',
 *   });
 *   if (!isWarning) return null;
 *   return (
 *     <dialog open>
 *       You will be signed out in {Math.ceil(remaining / 1000)} s.
 *       <button onClick={reset}>Stay signed in</button>
 *     </dialog>
 *   );
 * }
 */
export function useIdleRedirect(options: IdleRedirectOptions = {}): IdleTimerState {
  const opts = useRef(options);
  opts.current = options;
  const redirected = useRef(false);

  return useIdleTimer({
    ...options,
    onIdle: () => {
      if (redirected.current) return;
      redirected.current = true;
      const { onIdle, redirectTo = '/login', withReturnTo = true, navigate } = opts.current;
      void Promise.resolve()
        .then(() => onIdle?.())
        .catch(() => undefined)
        .then(() => {
          const url = buildIdleRedirectUrl(redirectTo, withReturnTo);
          if (navigate) navigate(url);
          else if (typeof window !== 'undefined') window.location.assign(url);
        });
    },
  });
}
