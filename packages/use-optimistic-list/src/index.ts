import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Key = string | number;

type Op<T> =
  | { kind: 'create'; opId: number; item: T; tempKey: Key; index?: number }
  | { kind: 'update'; opId: number; key: Key; patch: Partial<T> }
  | { kind: 'remove'; opId: number; key: Key }
  | { kind: 'move'; opId: number; key: Key; toIndex: number };

export interface OptimisticError<T> {
  opId: number;
  type: 'create' | 'update' | 'remove' | 'move';
  key: Key;
  error: unknown;
  /** The optimistic value that was rolled back. */
  item?: T;
}

export interface OptimisticListOptions<T> {
  /** Server/initial items. Changing this replaces the confirmed state (pending operations stay applied on top). */
  initialItems?: T[];
  /** Unique key of an item. @default (item) => item.id */
  getKey?: (item: T) => Key;
  /** Persist a new item; return the saved item (with its real id). */
  onCreate?: (item: T) => Promise<T | void>;
  /** Persist an update; return the saved item to reconcile. */
  onUpdate?: (key: Key, patch: Partial<T>, item: T) => Promise<T | void>;
  onRemove?: (key: Key, item: T) => Promise<unknown>;
  /** Persist a move (drag & drop reorder). */
  onMove?: (key: Key, toIndex: number, items: T[]) => Promise<unknown>;
  /** Called when an operation failed and was rolled back. */
  onError?: (error: OptimisticError<T>) => void;
}

export interface OptimisticList<T> {
  /** Confirmed items with all pending operations applied. */
  items: T[];
  /** Add an item (shown immediately with `tempKey` until the server responds). */
  create: (item: T, options?: { index?: number; tempKey?: Key }) => Promise<T | undefined>;
  update: (key: Key, patch: Partial<T>) => Promise<T | undefined>;
  remove: (key: Key) => Promise<boolean>;
  move: (key: Key, toIndex: number) => Promise<boolean>;
  /** Keys with pending operations (show spinners / dim rows). */
  pendingKeys: Set<Key>;
  isPending: (key: Key) => boolean;
  /** Failed operations (already rolled back). */
  errors: OptimisticError<T>[];
  clearErrors: () => void;
  /** Replace the confirmed list (e.g. after refetch). */
  setItems: (items: T[] | ((prev: T[]) => T[])) => void;
}

let tempCounter = 0;

function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    try {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    } catch {
      return false;
    }
  }
  return true;
}
const defaultGetKey = (item: unknown) => (item as { id: Key }).id;

function applyOp<T>(items: T[], op: Op<T>, getKey: (item: T) => Key): T[] {
  switch (op.kind) {
    case 'create': {
      if (items.some((i) => getKey(i) === op.tempKey)) return items;
      const next = items.slice();
      next.splice(op.index ?? next.length, 0, op.item);
      return next;
    }
    case 'update':
      return items.map((i) => (getKey(i) === op.key ? { ...i, ...op.patch } : i));
    case 'remove':
      return items.filter((i) => getKey(i) !== op.key);
    case 'move': {
      const from = items.findIndex((i) => getKey(i) === op.key);
      if (from < 0) return items;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(op.toIndex, next.length)), 0, moved);
      return next;
    }
  }
}

/**
 * Optimistic CRUD list with per-operation rollback.
 *
 * The list is "confirmed items + pending operations". Each change is applied at once; when its
 * request succeeds it is folded into the confirmed items (with the server's version of the item),
 * when it fails only that operation is dropped — other in-flight changes stay.
 *
 * @example
 * const todos = useOptimisticList<Todo>({
 *   initialItems: data,
 *   onCreate: (todo) => api.post('/todos', todo),
 *   onUpdate: (id, patch) => api.patch(`/todos/${id}`, patch),
 *   onRemove: (id) => api.delete(`/todos/${id}`),
 *   onError: ({ type }) => toast.error(`Could not ${type} the todo`),
 * });
 *
 * todos.create({ id: crypto.randomUUID(), title: 'Buy milk', done: false });
 * todos.update(todo.id, { done: true });
 * todos.remove(todo.id);
 */
export function useOptimisticList<T>(options: OptimisticListOptions<T> = {}): OptimisticList<T> {
  const getKey = (options.getKey ?? defaultGetKey) as (item: T) => Key;
  const opts = useRef(options);
  opts.current = options;

  const [confirmed, setConfirmed] = useState<T[]>(options.initialItems ?? []);
  const [ops, setOps] = useState<Op<T>[]>([]);
  const [errors, setErrors] = useState<OptimisticError<T>[]>([]);
  const confirmedRef = useRef(confirmed);
  const opsRef = useRef(ops);
  const nextOpId = useRef(1);
  /** tempKey → promise of the real key (undefined if the create failed) */
  const creating = useRef(new Map<Key, Promise<Key | undefined>>());

  // Operations on an item that is still being created wait for it and use its real key.
  const resolveKey = async (key: Key): Promise<Key> => {
    const pending = creating.current.get(key);
    if (!pending) return key;
    const real = await pending;
    if (real === undefined) throw new Error('The item could not be created');
    return real;
  };

  // follow `initialItems` changes (e.g. a refetch) — pending operations stay applied on top.
  // Compared by content, so inline arrays (`initialItems: data ?? []`) don't cause render loops.
  const lastInitial = useRef(options.initialItems);
  useEffect(() => {
    const next = options.initialItems ?? [];
    if (sameItems(lastInitial.current ?? [], next)) return;
    lastInitial.current = next;
    confirmedRef.current = next;
    setConfirmed(next);
  }, [options.initialItems]);

  const commitConfirmed = (next: T[]) => {
    confirmedRef.current = next;
    setConfirmed(next);
  };
  const commitOps = (next: Op<T>[]) => {
    opsRef.current = next;
    setOps(next);
  };

  const view = useCallback(
    (base: T[] = confirmedRef.current, list: Op<T>[] = opsRef.current) => list.reduce((acc, op) => applyOp(acc, op, getKey), base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const items = useMemo(() => ops.reduce((acc, op) => applyOp(acc, op, getKey), confirmed), [confirmed, ops]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(
    async <R>(op: Op<T>, request: (() => Promise<R>) | undefined, onSuccess: (result: R) => void, rollbackItem?: T): Promise<{ ok: boolean; result?: R }> => {
      commitOps([...opsRef.current, op]);
      if (!request) {
        // no persistence handler: just confirm
        commitOps(opsRef.current.filter((o) => o.opId !== op.opId));
        commitConfirmed(applyOp(confirmedRef.current, op, getKey));
        return { ok: true };
      }
      try {
        const result = await request();
        commitOps(opsRef.current.filter((o) => o.opId !== op.opId));
        onSuccess(result);
        return { ok: true, result };
      } catch (error) {
        commitOps(opsRef.current.filter((o) => o.opId !== op.opId));
        const key = op.kind === 'create' ? op.tempKey : op.key;
        const failure: OptimisticError<T> = { opId: op.opId, type: op.kind, key, error, item: rollbackItem };
        setErrors((prev) => [...prev, failure]);
        opts.current.onError?.(failure);
        return { ok: false };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const create = useCallback(
    async (item: T, o: { index?: number; tempKey?: Key } = {}) => {
      const tempKey = o.tempKey ?? getKey(item) ?? `temp-${++tempCounter}`;
      const op: Op<T> = { kind: 'create', opId: nextOpId.current++, item, tempKey, index: o.index };
      const handler = opts.current.onCreate;
      let saved: T | undefined = item;
      let settle!: (k: Key | undefined) => void;
      creating.current.set(tempKey, new Promise((r) => (settle = r)));
      const res = await run(op, handler && (() => handler(item)), (result) => {
        saved = (result as T | void) ?? item;
        const base = confirmedRef.current.filter((i) => getKey(i) !== tempKey);
        const index = Math.min(o.index ?? base.length, base.length);
        const next = base.slice();
        next.splice(index, 0, saved);
        commitConfirmed(next);
        // pending ops that targeted the temp key now target the real key
        const realKey = getKey(saved);
        if (realKey !== tempKey) {
          commitOps(opsRef.current.map((p) => (p.kind !== 'create' && p.key === tempKey ? { ...p, key: realKey } : p)));
        }
      }, item);
      creating.current.delete(tempKey);
      settle(res.ok && saved !== undefined ? getKey(saved) : undefined);
      return res.ok ? saved : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run],
  );

  const update = useCallback(
    async (key: Key, patch: Partial<T>) => {
      const current = view().find((i) => getKey(i) === key);
      if (!current) return undefined;
      const op: Op<T> = { kind: 'update', opId: nextOpId.current++, key, patch };
      const handler = opts.current.onUpdate;
      const merged = { ...current, ...patch } as T;
      let saved: T | undefined = merged;
      let target: Key = key;
      const request = async () => {
        target = await resolveKey(key);
        return handler ? handler(target, patch, merged) : undefined;
      };
      const res = await run(op, request, (result) => {
        const server = result as T | void;
        // trust the server's item only if it is the same item (some APIs echo the request body)
        const usable = server && getKey(server) === target ? server : undefined;
        commitConfirmed(confirmedRef.current.map((i) => (getKey(i) === target ? (usable ?? { ...i, ...patch }) : i)));
        saved = confirmedRef.current.find((i) => getKey(i) === target) ?? merged;
      }, current);
      return res.ok ? saved : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, view],
  );

  const remove = useCallback(
    async (key: Key) => {
      const current = view().find((i) => getKey(i) === key);
      if (!current) return false;
      const op: Op<T> = { kind: 'remove', opId: nextOpId.current++, key };
      const handler = opts.current.onRemove;
      let target: Key = key;
      const request = async () => {
        target = await resolveKey(key);
        return handler ? handler(target, current) : undefined;
      };
      const res = await run(op, request, () => {
        commitConfirmed(confirmedRef.current.filter((i) => getKey(i) !== target));
      }, current);
      return res.ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, view],
  );

  const move = useCallback(
    async (key: Key, toIndex: number) => {
      const op: Op<T> = { kind: 'move', opId: nextOpId.current++, key, toIndex };
      const handler = opts.current.onMove;
      const preview = applyOp(view(), op, getKey);
      let target: Key = key;
      const request = async () => {
        target = await resolveKey(key);
        return handler ? handler(target, toIndex, preview) : undefined;
      };
      const res = await run(op, request, () => {
        commitConfirmed(applyOp(confirmedRef.current, { ...op, key: target }, getKey));
      });
      return res.ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, view],
  );

  const pendingKeys = useMemo(() => new Set(ops.map((o) => (o.kind === 'create' ? o.tempKey : o.key))), [ops]);

  const setItems = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    commitConfirmed(typeof next === 'function' ? next(confirmedRef.current) : next);
  }, []);

  return {
    items,
    create,
    update,
    remove,
    move,
    pendingKeys,
    isPending: (key) => pendingKeys.has(key),
    errors,
    clearErrors: useCallback(() => setErrors([]), []),
    setItems,
  };
}
