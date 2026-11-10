# use-typed-url-state

[![npm](https://img.shields.io/npm/v/use-typed-url-state.svg)](https://www.npmjs.com/package/use-typed-url-state)
[![size](https://img.shields.io/bundlephobia/minzip/use-typed-url-state)](https://bundlephobia.com/package/use-typed-url-state)

**`useState` that lives in the URL — fully typed.** Filters, pagination, sorting and tabs survive reloads, can be shared as links and work with the back button. Numbers are numbers, booleans are booleans, enums are unions; defaults stay out of the URL.

```tsx
import { useUrlState, param } from 'use-typed-url-state';

const filtersSchema = {
  q: param.string(''),
  page: param.integer(1),
  sort: param.enum(['new', 'price', 'rating'], 'new'),
  tags: param.array(param.string()),
  inStock: param.boolean(false),
  minPrice: param.number(),          // number | undefined
};

function Products() {
  const [filters, setFilters] = useUrlState(filtersSchema);

  return (
    <>
      <input value={filters.q} onChange={(e) => setFilters({ q: e.target.value, page: 1 })} />
      <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as typeof filters.sort })}>
        <option value="new">Newest</option>
        <option value="price">Price</option>
      </select>
      <ProductList {...filters} />
      <button onClick={() => setFilters((f) => ({ page: f.page + 1 }))}>Next page</button>
    </>
  );
}
// URL: /products?q=phone&sort=price&page=2
```

## Install

```bash
npm install use-typed-url-state
```

## Param types

| Builder | Type | URL |
| --- | --- | --- |
| `param.string(default?)` | `string` | `?q=phone` |
| `param.number(default?)` | `number` | `?price=9.5` |
| `param.integer(default?)` | `number` | `?page=2` |
| `param.boolean(default?)` | `boolean` | `?inStock=true` (`1`/`0` accepted) |
| `param.date(default?)` | `Date` | `?from=2026-01-31` or ISO |
| `param.enum(values, default)` | union | `?sort=price` |
| `param.array(item, { separator?, default? })` | `T[]` | `?tag=a&tag=b` or `?tag=a,b` |
| `param.json(default)` | `T` | `?range={"min":1}` |

Without a default, the type includes `undefined`. Invalid values (e.g. `?page=abc`) fall back to the default — no crashes from hand-edited URLs.

## Updating

```ts
setFilters({ page: 2 });                       // merge
setFilters((prev) => ({ page: prev.page + 1 })); // from previous
setFilters({ q: null });                       // reset to default (removed from URL)
setFilters({ page: 3 }, { history: 'push' });  // make this step undoable with Back
```

Default mode is `replace` (no history spam); set `useUrlState(schema, { history: 'push' })` to push every change. Unrelated query params (`utm_*` etc.) are preserved. All hooks reading the URL stay in sync.

## Building links

```ts
import { serializeUrlState } from 'use-typed-url-state';
<a href={`/products?${serializeUrlState(filtersSchema, { sort: 'price', tags: ['sale'] })}`}>Sale</a>
```

`parseUrlState(schema, search)` reads values anywhere (e.g. in a Next.js server component from `searchParams`).

## Frameworks

Works with any router that uses the browser History API. **Next.js (App Router, 14.1+)** picks up the changes in `useSearchParams` automatically. For SSR pass the request query: `useUrlState(schema, { serverSearch: '?' + new URLSearchParams(searchParams) })`.

## Comparison

| | use-typed-url-state | nuqs | use-query-params | `useSearchParams` |
| --- | --- | --- | --- | --- |
| Typed values & defaults | ✅ | ✅ | ✅ | strings only |
| Framework adapters needed | no | yes | yes | – |
| Size | ~1.5 KB | ~5 KB | ~6 KB + serialize-query-params | – |

## License

MIT
