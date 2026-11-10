import { act, renderHook, waitFor } from '@testing-library/react';
import { useOfflineQueue, PermanentError } from '../src';

let online = true;
beforeAll(() => {
  jest.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
});
beforeEach(() => {
  online = true;
  localStorage.clear();
});

const goOnline = () => {
  online = true;
  window.dispatchEvent(new Event('online'));
};
const goOffline = () => {
  online = false;
  window.dispatchEvent(new Event('offline'));
};

describe('useOfflineQueue', () => {
  it('sends immediately when online', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useOfflineQueue<{ n: number }>({ key: 'q1', handler, onSuccess }));
    act(() => {
      result.current.enqueue('add', { n: 1 });
    });
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
    expect(handler.mock.calls[0][0]).toMatchObject({ type: 'add', payload: { n: 1 }, attempts: 1 });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('queues while offline, persists, and flushes in order when back online', async () => {
    const sent: number[] = [];
    const handler = jest.fn(async (a: { payload: number }) => {
      sent.push(a.payload);
    });
    act(() => goOffline());
    const { result, unmount } = renderHook(() => useOfflineQueue<number>({ key: 'q2', handler }));
    act(() => {
      result.current.enqueue('x', 1);
      result.current.enqueue('x', 2);
    });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.pending).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('q2')!)).toHaveLength(2);
    unmount();

    // a new mount (page reload) restores the queue
    const second = renderHook(() => useOfflineQueue<number>({ key: 'q2', handler }));
    expect(second.result.current.pending.map((a) => a.payload)).toEqual([1, 2]);
    act(() => goOnline());
    await waitFor(() => expect(second.result.current.pending).toHaveLength(0));
    expect(sent).toEqual([1, 2]);
    expect(localStorage.getItem('q2')).toBe('[]');
  });

  it('retries with backoff, then succeeds', async () => {
    let calls = 0;
    const handler = jest.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('503');
    });
    const { result } = renderHook(() => useOfflineQueue({ key: 'q3', handler, retryDelay: () => 10 }));
    act(() => {
      result.current.enqueue('x', null);
    });
    await waitFor(() => expect(result.current.pending).toHaveLength(0), { timeout: 2000 });
    expect(calls).toBe(3);
  });

  it('PermanentError and maxAttempts move actions to failed; retry/remove work', async () => {
    const onFailure = jest.fn();
    const handler = jest.fn(async (a: { payload: string }) => {
      if (a.payload === 'bad') throw new PermanentError('422 invalid');
      throw new Error('down');
    });
    const { result } = renderHook(() => useOfflineQueue<string>({ key: 'q4', handler, maxAttempts: 2, retryDelay: () => 5, onFailure }));
    act(() => {
      result.current.enqueue('x', 'bad');
      result.current.enqueue('x', 'flaky');
    });
    await waitFor(() => expect(result.current.failed).toHaveLength(2), { timeout: 2000 });
    expect(result.current.failed[0]).toMatchObject({ payload: 'bad', attempts: 1, error: '422 invalid' });
    expect(result.current.failed[1]).toMatchObject({ payload: 'flaky', attempts: 2 });
    expect(onFailure).toHaveBeenCalledTimes(2);

    handler.mockImplementation((async () => undefined) as never);
    act(() => result.current.retry(result.current.failed[1].id));
    await waitFor(() => expect(result.current.failed).toHaveLength(1));
    act(() => result.current.remove(result.current.failed[0].id));
    expect(result.current.failed).toHaveLength(0);
  });

  it('never sends an action twice (unmounted instance + new instance with the same key)', async () => {
    const sent: string[] = [];
    const handler = jest.fn(async (a: { id: string }) => {
      sent.push(a.id);
    });
    act(() => goOffline());
    const first = renderHook(() => useOfflineQueue({ key: 'q5', handler }));
    act(() => {
      first.result.current.enqueue('x', 1);
      first.result.current.enqueue('x', 2);
    });
    first.unmount();
    const second = renderHook(() => useOfflineQueue({ key: 'q5', handler }));
    act(() => goOnline());
    await waitFor(() => expect(second.result.current.pending).toHaveLength(0));
    expect(sent).toHaveLength(2);
    expect(new Set(sent).size).toBe(2);
  });
});
