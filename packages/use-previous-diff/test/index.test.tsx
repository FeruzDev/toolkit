import { renderHook } from '@testing-library/react';
import { diff, usePrevious, usePreviousDiff } from '../src';

describe('diff', () => {
  it('finds nested added/removed/changed values with paths', () => {
    const a = { name: 'Ali', age: 30, address: { city: 'Tashkent', zip: '100000' }, tags: ['a', 'b'], when: new Date(1) };
    const b = { name: 'Ali', age: 31, address: { city: 'Samarkand' }, tags: ['a', 'b', 'c'], when: new Date(1), vip: true };
    expect(diff(a, b).map(({ key, type, from, to }) => ({ key, type, from, to }))).toEqual([
      { key: 'age', type: 'changed', from: 30, to: 31 },
      { key: 'address.city', type: 'changed', from: 'Tashkent', to: 'Samarkand' },
      { key: 'address.zip', type: 'removed', from: '100000', to: undefined },
      { key: 'tags[2]', type: 'added', from: undefined, to: 'c' },
      { key: 'vip', type: 'added', from: undefined, to: true },
    ]);
  });

  it('supports shallow mode, ignore and arrayKey', () => {
    expect(diff({ a: { x: 1 } }, { a: { x: 2 } }, { deep: false })).toEqual([
      { path: ['a'], key: 'a', type: 'changed', from: { x: 1 }, to: { x: 2 } },
    ]);
    expect(diff({ a: 1, updatedAt: 1 }, { a: 1, updatedAt: 2 }, { ignore: ['updatedAt'] })).toEqual([]);
    const before = [{ id: 1, q: 1 }, { id: 2, q: 1 }];
    const after = [{ id: 2, q: 5 }, { id: 3, q: 1 }];
    expect(diff(before, after, { arrayKey: (i) => (i as { id: number }).id }).map((c) => `${c.type}:${c.key}`)).toEqual([
      'removed:[0]',
      'changed:[0].q',
      'added:[1]',
    ]);
  });

  it('primitives', () => {
    expect(diff(1, 1)).toEqual([]);
    expect(diff(1, 2)).toEqual([{ path: [], key: '', type: 'changed', from: 1, to: 2 }]);
  });
});

describe('usePrevious', () => {
  it('returns the previous distinct value', () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 1 } });
    expect(result.current).toBeUndefined();
    rerender({ v: 2 });
    expect(result.current).toBe(1);
    rerender({ v: 2 }); // unrelated re-render keeps the previous value
    expect(result.current).toBe(1);
    rerender({ v: 3 });
    expect(result.current).toBe(2);
  });
});

describe('usePreviousDiff', () => {
  it('exposes changes, hasChanged and calls onChange', () => {
    const onChange = jest.fn();
    const { result, rerender } = renderHook(({ order }) => usePreviousDiff(order, { onChange }), {
      initialProps: { order: { id: 1, status: 'new', customer: { name: 'Ali' } } },
    });
    expect(result.current.changed).toBe(false);
    rerender({ order: { id: 1, status: 'paid', customer: { name: 'Vali' } } });
    expect(result.current.changed).toBe(true);
    expect([...result.current.changedKeys]).toEqual(['status', 'customer.name']);
    expect(result.current.hasChanged('customer')).toBe(true);
    expect(result.current.hasChanged('id')).toBe(false);
    expect(result.current.previous?.status).toBe('new');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a new object with equal content reports no changes', () => {
    const { result, rerender } = renderHook(({ v }) => usePreviousDiff(v), { initialProps: { v: { a: 1 } } });
    rerender({ v: { a: 1 } });
    expect(result.current.changed).toBe(false);
  });
});
