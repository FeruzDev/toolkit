import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

/** Describes one query parameter: how to read it, write it, and its default. */
export interface Param<T> {
  parse: (values: string[]) => T;
  serialize: (value: T) => string[];
  default: T;
  /** Compare with default to omit it from the URL. */
  equals?: (a: T, b: T) => boolean;
}

export type Schema = Record<string, Param<any>>;
export type ValuesOf<S extends Schema> = { [K in keyof S]: S[K] extends Param<infer T> ? T : never };
/** Partial update; `null` resets a key to its default. */
export type Update<S extends Schema> = { [K in keyof S]?: ValuesOf<S>[K] | null };

function scalar<T>(parseOne: (raw: string) => T | undefined, serializeOne: (v: T) => string) {
  function make(): Param<T | undefined>;
  function make(defaultValue: T): Param<T>;
  function make(defaultValue?: T): Param<any> {
    return {
      default: defaultValue,
      parse: (values) => {
        if (!values.length) return defaultValue;
        const v = parseOne(values[values.length - 1]);
        return v === undefined ? defaultValue : v;
      },
      serialize: (v) => (v === undefined || v === null ? [] : [serializeOne(v as T)]),
    };
  }
  return make;
}

const arrayEquals = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Parameter builders. Without a default the type includes `undefined`. */
export const param = {
  /** `?q=hello` */
  string: scalar<string>((s) => s, (v) => v),
  /** `?page=2` (invalid numbers fall back to the default) */
  number: scalar<number>((s) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined), (v) => String(v)),
  /** `?page=2` (integers only) */
  integer: scalar<number>((s) => (/^-?\d+$/.test(s) ? Number(s) : undefined), (v) => String(Math.trunc(v))),
  /** `?active=true` / `1` / `false` / `0` */
  boolean: scalar<boolean>((s) => (s === 'true' || s === '1' ? true : s === 'false' || s === '0' ? false : undefined), (v) => (v ? 'true' : 'false')),
  /** `?from=2026-01-31` (date only) or full ISO string */
  date: scalar<Date>(
    (s) => {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    },
    (v) =>
      v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0 && v.getMilliseconds() === 0
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
        : v.toISOString(),
  ),

  /**
   * One of the given values (unknown values fall back to the default).
   * @example sort: param.enum(['new', 'price', 'rating'], 'new')
   */
  enum<const V extends readonly string[]>(values: V, defaultValue: V[number]): Param<V[number]> {
    return {
      default: defaultValue,
      parse: (raw) => {
        const v = raw[raw.length - 1];
        return v !== undefined && values.includes(v) ? (v as V[number]) : defaultValue;
      },
      serialize: (v) => [v],
    };
  },

  /**
   * Repeated keys: `?tag=a&tag=b` → `['a', 'b']`. Pass `{ separator: ',' }` for `?tag=a,b`.
   * @example tags: param.array(param.string())
   */
  array<T>(item: Param<T>, options: { default?: Array<Exclude<T, undefined>>; separator?: string } = {}): Param<Array<Exclude<T, undefined>>> {
    const def = options.default ?? [];
    const sep = options.separator;
    return {
      default: def,
      parse: (raw) => {
        if (!raw.length) return def;
        const parts = sep ? raw.flatMap((r) => r.split(sep)).filter((p) => p !== '') : raw;
        return parts.map((p) => item.parse([p])).filter((v): v is Exclude<T, undefined> => v !== undefined);
      },
      serialize: (v) => {
        const parts = v.flatMap((x) => item.serialize(x));
        return sep ? (parts.length ? [parts.join(sep)] : []) : parts;
      },
      equals: (a, b) => arrayEquals(a, b),
    };
  },

  /** Any JSON value: `?filters={"min":10}` */
  json<T>(defaultValue: T): Param<T> {
    return {
      default: defaultValue,
      parse: (raw) => {
        const v = raw[raw.length - 1];
        if (v === undefined) return defaultValue;
        try {
          return JSON.parse(v) as T;
        } catch {
          return defaultValue;
        }
      },
      serialize: (v) => [JSON.stringify(v)],
      equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    };
  },
};

const isDefault = <T>(p: Param<T>, v: T) =>
  p.equals ? p.equals(v, p.default) : v instanceof Date && p.default instanceof Date ? v.getTime() === p.default.getTime() : Object.is(v, p.default);

/** Read typed values from a query string (`location.search`). */
export function parseUrlState<S extends Schema>(schema: S, search: string | URLSearchParams): ValuesOf<S> {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) out[key] = schema[key].parse(params.getAll(key));
  return out as ValuesOf<S>;
}

/**
 * Write values into URLSearchParams (defaults are removed, unrelated params kept).
 * Handy for building links: `href={'/products?' + serializeUrlState(schema, { page: 2 })}`.
 */
export function serializeUrlState<S extends Schema>(schema: S, values: Update<S>, base: string | URLSearchParams = ''): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of Object.keys(values) as Array<keyof S & string>) {
    if (!(key in schema)) continue;
    const p = schema[key];
    const raw = values[key];
    params.delete(key);
    const v = raw === null || raw === undefined ? p.default : raw;
    if (isDefault(p, v)) continue;
    for (const s of p.serialize(v)) params.append(key, s);
  }
  return params;
}

const EVENT = 'typed-url-state';
const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVENT, cb);
  };
};

export interface UrlStateOptions {
  /** `'replace'` (default) keeps history clean; `'push'` makes each change a back-button step. */
  history?: 'replace' | 'push';
  /** Query string used during SSR (e.g. from the request). @default '' */
  serverSearch?: string;
}

/**
 * `useState` that lives in the URL query string, with types and defaults.
 *
 * @example
 * const [filters, setFilters] = useUrlState({
 *   q: param.string(''),
 *   page: param.integer(1),
 *   sort: param.enum(['new', 'price'], 'new'),
 *   tags: param.array(param.string()),
 *   inStock: param.boolean(false),
 * });
 *
 * filters.page;                                      // number
 * setFilters({ q: 'phone', page: 1 });               // ?q=phone
 * setFilters((prev) => ({ page: prev.page + 1 }));   // ?q=phone&page=2
 * setFilters({ q: null });                           // reset q to default
 */
export function useUrlState<S extends Schema>(
  schema: S,
  options: UrlStateOptions = {},
): [ValuesOf<S>, (update: Update<S> | ((prev: ValuesOf<S>) => Update<S>), opts?: { history?: 'replace' | 'push' }) => void] {
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => options.serverSearch ?? '',
  );

  const keys = Object.keys(schema).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const values = useMemo(() => parseUrlState(schemaRef.current, search), [search, keys]);

  const setValues = useCallback(
    (update: Update<S> | ((prev: ValuesOf<S>) => Update<S>), opts?: { history?: 'replace' | 'push' }) => {
      const current = parseUrlState(schemaRef.current, window.location.search);
      const patch = typeof update === 'function' ? update(current) : update;
      const params = serializeUrlState(schemaRef.current, patch, window.location.search);
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      const mode = opts?.history ?? optionsRef.current.history ?? 'replace';
      if (mode === 'push') window.history.pushState(window.history.state, '', url);
      else window.history.replaceState(window.history.state, '', url);
      window.dispatchEvent(new Event(EVENT));
    },
    [],
  );

  return [values, setValues];
}
