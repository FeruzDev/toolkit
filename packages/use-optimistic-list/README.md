# use-optimistic-list

[![npm](https://img.shields.io/npm/v/use-optimistic-list.svg)](https://www.npmjs.com/package/use-optimistic-list)
[![size](https://img.shields.io/bundlephobia/minzip/use-optimistic-list)](https://bundlephobia.com/package/use-optimistic-list)

**Optimistic CRUD lists that roll back correctly.** Create, update, delete and reorder show up instantly; when the server answers, the real item (and real id) replaces the optimistic one; when a request fails, **only that operation** is undone — other changes in flight are kept.

```tsx
import { useOptimisticList } from 'use-optimistic-list';

function Todos({ initial }: { initial: Todo[] }) {
  const todos = useOptimisticList<Todo>({
    initialItems: initial,
    onCreate: (todo) => api.post<Todo>('/todos', todo),           // returns the saved todo (real id)
    onUpdate: (id, patch) => api.patch<Todo>(`/todos/${id}`, patch),
    onRemove: (id) => api.delete(`/todos/${id}`),
    onError: ({ type }) => toast.error(`Could not ${type} the todo — change undone`),
  });

  return (
    <ul>
      {todos.items.map((t) => (
        <li key={t.id} style={{ opacity: todos.isPending(t.id) ? 0.6 : 1 }}>
          <input type="checkbox" checked={t.done} onChange={() => todos.update(t.id, { done: !t.done })} />
          {t.title}
          <button onClick={() => todos.remove(t.id)}>×</button>
        </li>
      ))}
      <button onClick={() => todos.create({ id: crypto.randomUUID(), title: 'New todo', done: false })}>Add</button>
    </ul>
  );
}
```

## Install

```bash
npm install use-optimistic-list
```

## Why not just `setState` + `catch`?

The naive approach (`const prev = items; setItems(next); try { await save() } catch { setItems(prev) }`) breaks as soon as two requests overlap: rolling back request A also throws away request B's change. This hook stores **confirmed items + a list of pending operations** and always renders `confirmed ⊕ pending`:

| Situation | Result |
| --- | --- |
| Two updates in flight, first fails | Only the first is undone |
| Edit an item that is still being created | Shown instantly; the request **waits for the create** and uses the real id |
| Create succeeds with a server id | Temp item replaced by the server item; pending edits re-targeted |
| Create fails | Item disappears; dependent edits are rolled back too |
| Refetch while operations are pending | New `initialItems` become the base, pending operations stay on top |

## API

`useOptimisticList<T>(options)`

| Option | Description |
| --- | --- |
| `initialItems` | Server items. Updates when the content changes (inline arrays are safe) |
| `getKey(item)` | Default `item.id` |
| `onCreate(item)` | Persist; return the saved item to reconcile |
| `onUpdate(key, patch, item)` | Persist; return the saved item (optional) |
| `onRemove(key, item)` | Persist delete |
| `onMove(key, toIndex, items)` | Persist reorder |
| `onError({ type, key, error, item })` | Called after a rollback |

All handlers are optional — without one, the change is applied locally.

Returns:

| Field | Description |
| --- | --- |
| `items` | What to render |
| `create(item, { index?, tempKey? })` | → saved item or `undefined` on failure |
| `update(key, patch)` | → saved item or `undefined` |
| `remove(key)` / `move(key, toIndex)` | → `true` / `false` |
| `pendingKeys`, `isPending(key)` | Show spinners / dim rows |
| `errors`, `clearErrors()` | Failed (rolled back) operations |
| `setItems(items \| fn)` | Replace the confirmed list |

### With React Query

```tsx
const { data } = useQuery({ queryKey: ['todos'], queryFn: getTodos });
const todos = useOptimisticList({ initialItems: data ?? [], onUpdate: … });
```

## License

MIT
