import { act, renderHook } from '@testing-library/react';
import { useStaleData } from '../src';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => jest.useRealTimers());

describe('useStaleData', () => {
  it('is unknown without any update', () => {
    const { result } = renderHook(() => useStaleData({ updatedAt: null }));
    expect(result.current.status).toBe('unknown');
    expect(result.current.age).toBeNull();
  });

  it('goes fresh → warning → stale with updatedAt, and calls onStale once', () => {
    const onStale = jest.fn();
    const start = Date.now();
    const { result } = renderHook(() => useStaleData({ updatedAt: start }, { warnAfter: 5000, staleAfter: 10000, onStale }));
    expect(result.current.status).toBe('fresh');
    act(() => jest.advanceTimersByTime(5100));
    expect(result.current.status).toBe('warning');
    expect(result.current.isWarning).toBe(true);
    act(() => jest.advanceTimersByTime(5000));
    expect(result.current.status).toBe('stale');
    expect(result.current.age).toBeGreaterThanOrEqual(10000);
    act(() => jest.advanceTimersByTime(60000));
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('restarts the clock when data changes and calls onFresh', () => {
    const onFresh = jest.fn();
    const { result, rerender } = renderHook(({ data }) => useStaleData({ data }, { staleAfter: 1000, onFresh }), {
      initialProps: { data: { v: 1 } as unknown },
    });
    act(() => jest.advanceTimersByTime(1100));
    expect(result.current.isStale).toBe(true);
    rerender({ data: { v: 2 } });
    expect(result.current.status).toBe('fresh');
    expect(onFresh).toHaveBeenCalledTimes(1);
  });

  it('touch() marks data fresh', () => {
    const start = Date.now();
    const { result } = renderHook(() => useStaleData({ updatedAt: start }, { staleAfter: 1000 }));
    act(() => jest.advanceTimersByTime(2000));
    expect(result.current.isStale).toBe(true);
    act(() => result.current.touch());
    expect(result.current.isStale).toBe(false);
  });

  it('tick keeps age live', () => {
    const start = Date.now();
    const { result } = renderHook(() => useStaleData({ updatedAt: start }, { staleAfter: 60000, tick: 1000 }));
    act(() => jest.advanceTimersByTime(3050));
    expect(result.current.age).toBeGreaterThanOrEqual(3000);
    expect(result.current.updatedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('enabled: false reports unknown', () => {
    const old = Date.now() - 999999;
    const { result } = renderHook(() => useStaleData({ updatedAt: old }, { enabled: false }));
    expect(result.current.status).toBe('unknown');
  });
});
