import { act, renderHook } from '@testing-library/react';
import { useUrlState, param, parseUrlState, serializeUrlState } from '../src';

const schema = {
  q: param.string(''),
  page: param.integer(1),
  price: param.number(),
  sort: param.enum(['new', 'price'], 'new'),
  tags: param.array(param.string()),
  ids: param.array(param.integer(), { separator: ',' }),
  inStock: param.boolean(false),
  from: param.date(),
  range: param.json({ min: 0, max: 100 }),
};

beforeEach(() => window.history.replaceState(null, '', '/products'));

describe('parse / serialize', () => {
  it('parses typed values with fallbacks', () => {
    const v = parseUrlState(schema, '?q=phone&page=3&price=9.5&sort=bogus&tags=a&tags=b&ids=1,2,x&inStock=1&from=2026-01-31&range={"min":5,"max":9}');
    expect(v).toEqual({
      q: 'phone',
      page: 3,
      price: 9.5,
      sort: 'new',
      tags: ['a', 'b'],
      ids: [1, 2],
      inStock: true,
      from: new Date('2026-01-31T00:00:00'),
      range: { min: 5, max: 9 },
    });
    expect(parseUrlState(schema, '?page=abc').page).toBe(1);
    expect(parseUrlState(schema, '').price).toBeUndefined();
  });

  it('omits defaults and keeps unrelated params', () => {
    const params = serializeUrlState(schema, { q: 'tv', page: 1, tags: ['x', 'y'], ids: [3, 4], from: new Date(2026, 0, 2), range: { min: 0, max: 100 } }, '?utm=ad&page=5');
    expect(params.toString()).toBe('utm=ad&q=tv&tags=x&tags=y&ids=3%2C4&from=2026-01-02');
  });
});

describe('useUrlState', () => {
  it('reads and writes the URL', () => {
    window.history.replaceState(null, '', '/products?q=phone&page=2#top');
    const { result } = renderHook(() => useUrlState(schema));
    expect(result.current[0].q).toBe('phone');
    expect(result.current[0].page).toBe(2);

    act(() => result.current[1]((prev) => ({ page: prev.page + 1, sort: 'price' })));
    expect(window.location.search).toBe('?q=phone&page=3&sort=price');
    expect(window.location.hash).toBe('#top');
    expect(result.current[0].page).toBe(3);

    act(() => result.current[1]({ q: null, page: 1 }));
    expect(window.location.search).toBe('?sort=price');
  });

  it('push mode adds history entries and back button updates state', async () => {
    const { result } = renderHook(() => useUrlState(schema, { history: 'push' }));
    const before = window.history.length;
    act(() => result.current[1]({ page: 2 }));
    act(() => result.current[1]({ page: 3 }));
    expect(window.history.length).toBe(before + 2);

    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current[0].page).toBe(2);
  });

  it('two hooks stay in sync', () => {
    const a = renderHook(() => useUrlState({ page: param.integer(1) }));
    const b = renderHook(() => useUrlState({ page: param.integer(1) }));
    act(() => a.result.current[1]({ page: 7 }));
    expect(b.result.current[0].page).toBe(7);
  });

  it('is type-safe', () => {
    const { result } = renderHook(() => useUrlState(schema));
    const [v, set] = result.current;
    const n: number = v.page;
    const s: 'new' | 'price' = v.sort;
    const p: number | undefined = v.price;
    // @ts-expect-error wrong type
    set({ page: 'two' });
    // @ts-expect-error unknown enum value
    set({ sort: 'cheap' });
    expect([n, s, p]).toBeTruthy();
  });
});
