import { act, renderHook } from '@testing-library/react';
import { useThrottledStream, type Subscribe } from '../src';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

class FakeSocket extends EventTarget {
  send(data: unknown) {
    const e = new Event('message') as Event & { data: unknown };
    e.data = data;
    this.dispatchEvent(e);
  }
}

describe('useThrottledStream', () => {
  it('batches messages into one render per interval (append mode)', () => {
    const socket = new FakeSocket();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useThrottledStream<{ n: number }>(socket as never, { interval: 100, maxItems: 5 });
    });
    const before = renders;
    act(() => {
      for (let n = 1; n <= 8; n++) socket.send(JSON.stringify({ n }));
    });
    act(() => jest.advanceTimersByTime(100));
    expect(result.current.data.map((m) => m.n)).toEqual([4, 5, 6, 7, 8]); // window of 5
    expect(renders - before).toBe(1); // 8 messages → 1 render
    expect(result.current.stats).toEqual({ received: 8, flushes: 1, lastBatch: 8 });
  });

  it('latest mode keeps only the newest message', () => {
    let emit: (m: number) => void = () => undefined;
    const subscribe: Subscribe<number> = (e) => {
      emit = e;
      return () => undefined;
    };
    const { result } = renderHook(() => useThrottledStream(subscribe, { mode: 'latest', interval: 50 }));
    act(() => {
      emit(1);
      emit(2);
      emit(3);
      jest.advanceTimersByTime(50);
    });
    expect(result.current.data).toBe(3);
  });

  it('reduce mode folds batches', () => {
    type Tick = { s: string; p: number };
    const { result } = renderHook(() =>
      useThrottledStream<Tick, Record<string, number>>(null, {
        mode: 'reduce',
        initialState: {},
        reducer: (state, batch) => ({ ...state, ...Object.fromEntries(batch.map((t) => [t.s, t.p])) }),
      }),
    );
    act(() => {
      result.current.push({ s: 'BTC', p: 1 }, { s: 'ETH', p: 2 }, { s: 'BTC', p: 3 });
      jest.advanceTimersByTime(100);
    });
    expect(result.current.data).toEqual({ BTC: 3, ETH: 2 });
  });

  it('filter, manual flush, clear and unsubscribe', () => {
    const unsubscribe = jest.fn();
    const { result, unmount } = renderHook(() => useThrottledStream<number>(() => unsubscribe, { filter: (n) => n % 2 === 0 }));
    act(() => {
      result.current.push(1, 2, 3, 4);
      result.current.flush();
    });
    expect(result.current.data).toEqual([2, 4]);
    act(() => result.current.clear());
    expect(result.current.data).toEqual([]);
    expect(result.current.stats.received).toBe(0);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('parses non-JSON strings as plain text', () => {
    const socket = new FakeSocket();
    const { result } = renderHook(() => useThrottledStream<string>(socket as never));
    act(() => {
      socket.send('hello');
      jest.advanceTimersByTime(100);
    });
    expect(result.current.data).toEqual(['hello']);
  });
});
