import { act, renderHook } from '@testing-library/react';
import { useVisibilityPolling } from '../src';

let visibility: DocumentVisibilityState = 'visible';
let online = true;
beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  jest.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
});
beforeEach(() => {
  visibility = 'visible';
  online = true;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};
const setVisible = async (v: DocumentVisibilityState) => {
  visibility = v;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await flush();
};

describe('useVisibilityPolling', () => {
  it('polls immediately and then every interval, without overlap', async () => {
    let n = 0;
    const fetcher = jest.fn(async () => ++n);
    const { result } = renderHook(() => useVisibilityPolling(fetcher, { interval: 1000 }));
    await flush();
    expect(result.current.data).toBe(1);
    expect(result.current.isLoading).toBe(false);
    await advance(1000);
    expect(result.current.data).toBe(2);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('pauses while hidden and refetches on return when stale', async () => {
    const fetcher = jest.fn(async () => 'ok');
    const { result } = renderHook(() => useVisibilityPolling(fetcher, { interval: 1000 }));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await setVisible('hidden');
    expect(result.current.isPaused).toBe(true);
    await advance(10_000);
    expect(fetcher).toHaveBeenCalledTimes(1); // nothing while hidden

    await setVisible('visible');
    expect(result.current.isPaused).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2); // immediate refetch, data was stale
  });

  it('aborts the in-flight request when paused', async () => {
    let signal: AbortSignal | undefined;
    const fetcher = jest.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<string>(() => undefined);
    });
    renderHook(() => useVisibilityPolling(fetcher, { interval: 1000 }));
    await flush();
    await setVisible('hidden');
    expect(signal?.aborted).toBe(true);
  });

  it('pauses offline, backs off after errors, and refresh() fetches now', async () => {
    let fail = true;
    const onError = jest.fn();
    const fetcher = jest.fn(async () => {
      if (fail) throw new Error('500');
      return 'ok';
    });
    const { result } = renderHook(() => useVisibilityPolling(fetcher, { interval: 1000, maxBackoff: 8000, onError }));
    await flush();
    expect(result.current.error).toBeInstanceOf(Error);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(1); // backoff: 2000 ms after 1st error
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    fail = false;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.data).toBe('ok');
    expect(result.current.error).toBeUndefined();

    online = false;
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isPaused).toBe(true);
  });

  it('enabled: false does nothing', async () => {
    const fetcher = jest.fn(async () => 1);
    const { result } = renderHook(() => useVisibilityPolling(fetcher, { enabled: false }));
    await advance(10_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });
});
