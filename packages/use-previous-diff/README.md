# use-previous-diff

[![npm](https://img.shields.io/npm/v/use-previous-diff.svg)](https://www.npmjs.com/package/use-previous-diff)
[![size](https://img.shields.io/bundlephobia/minzip/use-previous-diff)](https://bundlephobia.com/package/use-previous-diff)

**`usePrevious` that also tells you *what* changed.** Get the previous value and a deep, path-based diff — perfect for flashing changed cells in live tables, building audit logs, or finding out why a component re-renders.

```tsx
import { usePreviousDiff } from 'use-previous-diff';

function OrderRow({ order }: { order: Order }) {
  const { hasChanged } = usePreviousDiff(order);
  return (
    <tr>
      <td className={hasChanged('status') ? 'flash' : ''}>{order.status}</td>
      <td className={hasChanged('total') ? 'flash' : ''}>{order.total}</td>
    </tr>
  );
}
```

## Install

```bash
npm install use-previous-diff
```

## API

### `usePreviousDiff(value, options?)`

Returns `{ previous, current, changed, changes, changedKeys, hasChanged(key) }`.

```ts
const { changes } = usePreviousDiff(user);
// [{ key: 'address.city', path: ['address', 'city'], type: 'changed', from: 'Tashkent', to: 'Samarkand' },
//  { key: 'tags[2]', path: ['tags', 2], type: 'added', from: undefined, to: 'vip' }]
```

- `hasChanged('customer')` is true if `customer` or anything inside it changed.
- A new object with identical content reports **no** changes (deep compare), and unrelated re-renders don't reset the diff.

Debug re-renders:

```tsx
usePreviousDiff(props, { onChange: (changes) => console.table(changes) });
```

### `usePrevious(value)`

The previous **distinct** value (`undefined` on first render).

### `diff(a, b, options?)` — plain function

Works anywhere (audit logs on the server, undo history…).

| Option | Default | Description |
| --- | --- | --- |
| `deep` | `true` | Compare nested objects/arrays |
| `maxDepth` | `10` | Nesting limit |
| `ignore` | `[]` | Dotted paths to skip, e.g. `['updatedAt', 'meta.version']` |
| `arrayKey` | – | Match array items by id: `(item) => item.id` (otherwise by index) |
| `onChange` | – | Hook only: called with the changes |

Dates are compared by time; `Map`/`Set` by reference.

## License

MIT
