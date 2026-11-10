import { act, renderHook } from '@testing-library/react';
import { useOptimisticList } from '../src';

type Todo = { id: string | number; title: string; done?: boolean };

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const titles = (items: Todo[]) => items.map((t) => t.title);

describe('useOptimisticList', () => {
  it('create shows immediately and reconciles the server id; follow-up updates move to the real id', async () => {
    const created = deferred<Todo>();
    const onUpdate = jest.fn(async (id: unknown, patch: Partial<Todo>, item: Todo) => item);
    const { result } = renderHook(() =>
      useOptimisticList<Todo>({ initialItems: [{ id: 1, title: 'a' }], onCreate: () => created.promise, onUpdate }),
    );

    let pending!: Promise<Todo | undefined>;
    act(() => {
      pending = result.current.create({ id: 'tmp', title: 'b' });
    });
    expect(titles(result.current.items)).toEqual(['a', 'b']);
    expect(result.current.isPending('tmp')).toBe(true);

    act(() => {
      void result.current.update('tmp', { done: true });
    });
    expect(result.current.items[1].done).toBe(true);

    await act(async () => {
      created.resolve({ id: 42, title: 'b' });
      await pending;
    });
    expect(result.current.items[1].id).toBe(42);
    expect(result.current.items[1].done).toBe(true);
    expect(onUpdate.mock.calls[0][0]).toBe(42); // update waited for the create and used the real id
  });

  it('rolls back only the failed operation while others succeed', async () => {
    const a = deferred();
    const b = deferred();
    const onError = jest.fn();
    const calls: Array<ReturnType<typeof deferred>> = [a, b];
    const { result } = renderHook(() =>
      useOptimisticList<Todo>({
        initialItems: [{ id: 1, title: 'one' }, { id: 2, title: 'two' }],
        onUpdate: () => calls.shift()!.promise as Promise<void>,
        onError,
      }),
    );

    let p1!: Promise<unknown>, p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.update(1, { title: 'ONE' });
      p2 = result.current.update(2, { title: 'TWO' });
    });
    expect(titles(result.current.items)).toEqual(['ONE', 'TWO']);

    await act(async () => {
      a.reject(new Error('409 conflict'));
      b.resolve(undefined);
      await Promise.all([p1, p2]);
    });
    expect(titles(result.current.items)).toEqual(['one', 'TWO']);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'update', key: 1 }));
    expect(result.current.errors).toHaveLength(1);
    act(() => result.current.clearErrors());
    expect(result.current.errors).toHaveLength(0);
  });

  it('remove and move, with rollback on failure', async () => {
    const onRemove = jest.fn(async () => {
      throw new Error('403');
    });
    const onMove = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      useOptimisticList<Todo>({ initialItems: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }], onRemove, onMove }),
    );
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.remove(2);
    });
    expect(ok).toBe(false);
    expect(titles(result.current.items)).toEqual(['a', 'b', 'c']);

    await act(async () => {
      ok = await result.current.move(3, 0);
    });
    expect(ok).toBe(true);
    expect(titles(result.current.items)).toEqual(['c', 'a', 'b']);
    expect(onMove).toHaveBeenCalledWith(3, 0, expect.any(Array));
  });

  it('works without handlers and follows new initialItems', async () => {
    const { result, rerender } = renderHook(({ items }) => useOptimisticList<Todo>({ initialItems: items }), {
      initialProps: { items: [{ id: 1, title: 'a' }] as Todo[] },
    });
    await act(async () => {
      await result.current.create({ id: 2, title: 'b' });
    });
    expect(titles(result.current.items)).toEqual(['a', 'b']);
    rerender({ items: [{ id: 9, title: 'fresh' }] });
    expect(titles(result.current.items)).toEqual(['fresh']);
  });
});
