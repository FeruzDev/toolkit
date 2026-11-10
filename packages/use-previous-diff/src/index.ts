import { useEffect, useMemo, useRef } from 'react';

export type ChangeType = 'added' | 'removed' | 'changed';

export interface Change {
  /** Path to the changed value, e.g. `['user', 'address', 'city']` or `['items', 2]`. */
  path: Array<string | number>;
  /** Dotted path, e.g. `user.address.city` / `items[2]`. */
  key: string;
  type: ChangeType;
  from: unknown;
  to: unknown;
}

export interface DiffOptions {
  /** Compare nested objects/arrays (otherwise only top-level keys). @default true */
  deep?: boolean;
  /** Max nesting depth. @default 10 */
  maxDepth?: number;
  /** Paths to ignore, dotted (`'updatedAt'`, `'meta.version'`). */
  ignore?: string[];
  /** Match array items by id instead of index (e.g. `(item) => item.id`). */
  arrayKey?: (item: unknown) => unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !(v instanceof Date) && !(v instanceof RegExp) && !(v instanceof Map) && !(v instanceof Set);

const toKey = (path: Array<string | number>) =>
  path.reduce<string>((acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${p}` : String(p)), '');

const sameLeaf = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
};

/**
 * Deep, path-based diff between two values.
 *
 * @example
 * diff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 }, d: 4 })
 * // [{ key: 'b.c', type: 'changed', from: 2, to: 3 }, { key: 'd', type: 'added', from: undefined, to: 4 }]
 */
export function diff(from: unknown, to: unknown, options: DiffOptions = {}): Change[] {
  const { deep = true, maxDepth = 10, ignore = [], arrayKey } = options;
  const out: Change[] = [];
  const ignored = new Set(ignore);

  const walk = (a: unknown, b: unknown, path: Array<string | number>, depth: number) => {
    const key = toKey(path);
    if (path.length && ignored.has(key)) return;
    if (sameLeaf(a, b)) return;

    const descend = (deep || depth === 0) && depth < maxDepth;
    if (descend && Array.isArray(a) && Array.isArray(b)) {
      if (arrayKey) {
        const mapA = new Map(a.map((item, i) => [arrayKey(item), { item, i }]));
        const mapB = new Map(b.map((item, i) => [arrayKey(item), { item, i }]));
        mapA.forEach(({ item, i }, id) => {
          const match = mapB.get(id);
          if (!match) out.push({ path: [...path, i], key: toKey([...path, i]), type: 'removed', from: item, to: undefined });
          else walk(item, match.item, [...path, match.i], depth + 1);
        });
        mapB.forEach(({ item, i }, id) => {
          if (!mapA.has(id)) out.push({ path: [...path, i], key: toKey([...path, i]), type: 'added', from: undefined, to: item });
        });
        return;
      }
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        if (i >= a.length) out.push({ path: [...path, i], key: toKey([...path, i]), type: 'added', from: undefined, to: b[i] });
        else if (i >= b.length) out.push({ path: [...path, i], key: toKey([...path, i]), type: 'removed', from: a[i], to: undefined });
        else walk(a[i], b[i], [...path, i], depth + 1);
      }
      return;
    }
    if (descend && isObject(a) && isObject(b) && !Array.isArray(a) && !Array.isArray(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      keys.forEach((k) => {
        const p = [...path, k];
        if (ignored.has(toKey(p))) return;
        if (!(k in a)) out.push({ path: p, key: toKey(p), type: 'added', from: undefined, to: b[k] });
        else if (!(k in b)) out.push({ path: p, key: toKey(p), type: 'removed', from: a[k], to: undefined });
        else walk(a[k], b[k], p, depth + 1);
      });
      return;
    }
    if (!path.length && a === undefined) {
      out.push({ path, key, type: 'added', from: a, to: b });
      return;
    }
    out.push({ path, key, type: 'changed', from: a, to: b });
  };

  walk(from, to, [], 0);
  return out;
}

/**
 * The value from the previous render (`undefined` on the first render).
 *
 * @example
 * const prevCount = usePrevious(count);
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<{ current: T | undefined; previous: T | undefined }>({ current: value, previous: undefined });
  if (!Object.is(ref.current.current, value)) {
    ref.current = { current: value, previous: ref.current.current };
  }
  return ref.current.previous;
}

export interface PreviousDiff<T> {
  previous: T | undefined;
  current: T;
  /** `true` when the value differs from the previous one (deeply, by default). */
  changed: boolean;
  changes: Change[];
  /** Quick lookup: `changedKeys.has('user.name')`. */
  changedKeys: Set<string>;
  /** `true` if this path or anything inside it changed. */
  hasChanged: (key: string) => boolean;
}

export interface PreviousDiffOptions<V = unknown> extends DiffOptions {
  /** Called whenever there are changes. */
  onChange?: (changes: Change[], previous: V | undefined, current: V) => void;
}

/**
 * Previous value plus a deep diff against the current one.
 * The diff compares with the last value that was *different* (by reference), so
 * unrelated re-renders don't clear it.
 *
 * @example
 * const { changes, hasChanged } = usePreviousDiff(order);
 * <td className={hasChanged('status') ? 'flash' : ''}>{order.status}</td>
 *
 * @example
 * // debug why a component re-renders
 * usePreviousDiff(props, { onChange: (changes) => console.table(changes) });
 */
export function usePreviousDiff<V>(value: V, options: PreviousDiffOptions<V> = {}): PreviousDiff<V> {
  const previous = usePrevious(value);
  const optsRef = useRef(options);
  optsRef.current = options;
  const ignoreKey = (options.ignore ?? []).join('|');

  const changes = useMemo(
    () => (previous === undefined ? [] : diff(previous, value, optsRef.current)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previous, value, options.deep, options.maxDepth, ignoreKey],
  );

  useEffect(() => {
    if (changes.length) optsRef.current.onChange?.(changes, previous, value);
  }, [changes]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const changedKeys = new Set(changes.map((c) => c.key));
    return {
      previous,
      current: value,
      changed: changes.length > 0,
      changes,
      changedKeys,
      hasChanged: (key: string) =>
        changedKeys.has(key) || changes.some((c) => c.key.startsWith(`${key}.`) || c.key.startsWith(`${key}[`)),
    };
  }, [changes, previous, value]);
}
