import { useCallback, useEffect, useRef } from 'react';

export type Politeness = 'polite' | 'assertive';

export interface AnnounceOptions {
  /**
   * `'polite'` waits until the screen reader is idle (status updates).
   * `'assertive'` interrupts immediately (alarms, errors). @default 'polite'
   */
  politeness?: Politeness;
  /** Remove the text from the live region after this many ms (keeps the DOM clean). @default 7000 */
  clearAfter?: number;
}

const REGION_ID = { polite: 'live-announcer-polite', assertive: 'live-announcer-assertive' } as const;

const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';

const timers: Partial<Record<Politeness, { set?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> }>> = {};

function getRegion(politeness: Politeness): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let region = document.getElementById(REGION_ID[politeness]);
  if (!region) {
    region = document.createElement('div');
    region.id = REGION_ID[politeness];
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    region.setAttribute('style', VISUALLY_HIDDEN);
    region.setAttribute('data-live-announcer', '');
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Announce a message to screen readers through a visually hidden `aria-live` region.
 * Works without React. Safe to call during SSR (no-op).
 *
 * @example
 * announce('3 new orders');
 * announce('Server CPU above 95%!', { politeness: 'assertive' });
 */
export function announce(message: string, options: AnnounceOptions = {}): void {
  const politeness = options.politeness ?? 'polite';
  const region = getRegion(politeness);
  if (!region) return;

  const t = (timers[politeness] ??= {});
  if (t.set) clearTimeout(t.set);
  if (t.clear) clearTimeout(t.clear);

  // Clear first, then set on the next tick: screen readers only announce changes,
  // so this also re-announces an identical message.
  region.textContent = '';
  t.set = setTimeout(() => {
    region.textContent = message;
    const clearAfter = options.clearAfter ?? 7000;
    if (clearAfter > 0) t.clear = setTimeout(() => (region.textContent = ''), clearAfter);
  }, 50);
}

/** Remove the live regions and pending announcements (useful in tests). */
export function resetAnnouncer(): void {
  for (const p of ['polite', 'assertive'] as const) {
    const t = timers[p];
    if (t?.set) clearTimeout(t.set);
    if (t?.clear) clearTimeout(t.clear);
    delete timers[p];
    if (typeof document !== 'undefined') document.getElementById(REGION_ID[p])?.remove();
  }
}

export interface LiveAnnouncer {
  /** Announce with the given politeness (default polite). */
  announce: (message: string, options?: AnnounceOptions) => void;
  /** Shortcut for `{ politeness: 'polite' }`. */
  announcePolite: (message: string) => void;
  /** Shortcut for `{ politeness: 'assertive' }` — for alarms and errors. */
  announceAssertive: (message: string) => void;
}

/**
 * React hook returning stable announce functions.
 *
 * @example
 * const { announceAssertive } = useLiveAnnouncer();
 * useEffect(() => { if (alarm) announceAssertive(`Alarm: ${alarm.title}`); }, [alarm]);
 */
export function useLiveAnnouncer(): LiveAnnouncer {
  const announceFn = useCallback((message: string, options?: AnnounceOptions) => announce(message, options), []);
  const announcePolite = useCallback((message: string) => announce(message, { politeness: 'polite' }), []);
  const announceAssertive = useCallback((message: string) => announce(message, { politeness: 'assertive' }), []);
  return { announce: announceFn, announcePolite, announceAssertive };
}

export interface AnnounceOnChangeOptions<T> extends AnnounceOptions {
  /** Announce the initial value on mount too. @default false */
  announceInitial?: boolean;
  /** Minimum ms between announcements; later changes inside the window are merged into one. @default 1000 */
  throttle?: number;
  /** Return `false` to skip announcing this change. */
  when?: (value: T, previous: T | undefined) => boolean;
}

/**
 * Announce automatically whenever `value` changes — ideal for dashboards
 * (alarm counts, statuses, live metrics). Fast changes are throttled so screen readers are not flooded.
 *
 * @example
 * useAnnounceOnChange(alarms.length, (n, prev) => `${n} active alarms`, {
 *   politeness: 'assertive',
 *   when: (n, prev) => n > (prev ?? 0), // only when alarms increase
 * });
 */
export function useAnnounceOnChange<T>(
  value: T,
  format: (value: T, previous: T | undefined) => string | null | undefined,
  options: AnnounceOnChangeOptions<T> = {},
): void {
  const prev = useRef<T | undefined>(undefined);
  const mounted = useRef(false);
  const lastAt = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ format, options });
  latest.current = { format, options };

  useEffect(() => {
    const previous = prev.current;
    const isFirst = !mounted.current;
    mounted.current = true;
    prev.current = value;

    const { format: fmt, options: opts } = latest.current;
    if (isFirst && !opts.announceInitial) return;
    if (!isFirst && Object.is(previous, value)) return;
    if (opts.when && !opts.when(value, previous)) return;

    const message = fmt(value, previous);
    if (!message) return;

    const throttle = opts.throttle ?? 1000;
    const run = () => {
      lastAt.current = Date.now();
      pending.current = null;
      announce(message, opts);
    };
    const wait = lastAt.current + throttle - Date.now();
    if (pending.current) clearTimeout(pending.current);
    if (wait <= 0) run();
    else pending.current = setTimeout(run, wait);
  }, [value]);

  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
}
