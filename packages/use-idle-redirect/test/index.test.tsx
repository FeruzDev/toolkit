import { act, renderHook } from '@testing-library/react';
import { useIdleTimer, useIdleRedirect, buildIdleRedirectUrl } from '../src';

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());

const move = () => window.dispatchEvent(new Event('mousemove'));

describe('useIdleTimer', () => {
  it('active → warning (with countdown) → idle, callbacks fire once', () => {
    const onWarn = jest.fn();
    const onIdle = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ timeout: 10_000, warningBefore: 3_000, onWarn, onIdle, crossTab: false }));
    expect(result.current.status).toBe('active');

    act(() => jest.advanceTimersByTime(7_100));
    expect(result.current.isWarning).toBe(true);
    expect(onWarn).toHaveBeenCalledTimes(1);
    const r1 = result.current.remaining;

    act(() => jest.advanceTimersByTime(1_000));
    expect(result.current.remaining).toBeLessThan(r1); // live countdown

    act(() => jest.advanceTimersByTime(3_000));
    expect(result.current.isIdle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(60_000));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('activity during warning returns to active; activity after idle needs reset()', () => {
    const onActive = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ timeout: 10_000, warningBefore: 3_000, onActive, crossTab: false, throttle: 0 }));
    act(() => jest.advanceTimersByTime(8_000));
    expect(result.current.isWarning).toBe(true);
    act(() => move());
    expect(result.current.status).toBe('active');
    expect(onActive).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(10_100));
    expect(result.current.isIdle).toBe(true);
    act(() => move());
    expect(result.current.isIdle).toBe(true);
    act(() => result.current.reset());
    expect(result.current.status).toBe('active');
  });

  it('pause/resume and enabled: false', () => {
    const { result } = renderHook(() => useIdleTimer({ timeout: 1_000, warningBefore: 0, crossTab: false }));
    act(() => result.current.pause());
    act(() => jest.advanceTimersByTime(5_000));
    expect(result.current.status).toBe('active');
    act(() => result.current.resume());
    act(() => jest.advanceTimersByTime(1_100));
    expect(result.current.isIdle).toBe(true);

    const disabled = renderHook(() => useIdleTimer({ timeout: 1_000, enabled: false }));
    act(() => jest.advanceTimersByTime(5_000));
    expect(disabled.result.current.status).toBe('active');
  });

  it('syncs activity from other tabs via storage events', () => {
    const { result } = renderHook(() => useIdleTimer({ timeout: 10_000, warningBefore: 3_000, storageKey: 'idle-test' }));
    act(() => jest.advanceTimersByTime(8_000));
    expect(result.current.isWarning).toBe(true);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'idle-test', newValue: String(Date.now()) }));
    });
    expect(result.current.status).toBe('active');
  });
});

describe('useIdleRedirect', () => {
  it('calls onIdle then navigates with returnTo', async () => {
    window.history.pushState({}, '', '/reports?tab=2');
    const order: string[] = [];
    const onIdle = jest.fn(async () => {
      order.push('logout');
    });
    const navigate = jest.fn((url: string) => order.push(url));
    renderHook(() => useIdleRedirect({ timeout: 1_000, warningBefore: 0, onIdle, navigate, crossTab: false }));
    await act(async () => {
      jest.advanceTimersByTime(1_100);
    });
    expect(order).toEqual(['logout', '/login?reason=idle&returnTo=%2Freports%3Ftab%3D2']);
  });

  it('buildIdleRedirectUrl without returnTo', () => {
    expect(buildIdleRedirectUrl('/signin', false)).toBe('/signin');
  });
});
