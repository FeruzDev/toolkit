# react-state-views

[![npm](https://img.shields.io/npm/v/react-state-views.svg)](https://www.npmjs.com/package/react-state-views)
[![size](https://img.shields.io/bundlephobia/minzip/react-state-views)](https://bundlephobia.com/package/react-state-views)

**Stop writing `if (isLoading) … if (error) … if (!data.length) …` in every component.**
`<AsyncView>` picks the right view — loading, error (with retry), empty (with a call to action) or your content — from React Query, SWR, Apollo or plain state. Ready-made, accessible state components included, with English, Uzbek and Russian texts.

```tsx
import { AsyncView } from 'react-state-views';

function Projects() {
  const query = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });

  return (
    <AsyncView query={query} empty={{ title: 'No projects yet', action: <button>New project</button> }}>
      {(projects) => <ProjectGrid items={projects} />}
    </AsyncView>
  );
}
```

## Install

```bash
npm install react-state-views
```

## What `<AsyncView>` does

1. **Loading** — shows a spinner only after `loadingDelay` (200 ms) so fast responses don't flash.
2. **Error** — `role="alert"` view with the server's message (`error.message`, `response.data.message`…), an offline hint, and a retry button wired to `refetch`/`mutate`.
3. **Empty** — `[]`, `{}`, `''`, `null`, empty `Map`/`Set` (or your `isEmpty`).
4. **Content** — `children(data)` with `data` typed as non-null.

While refetching (or after a background refetch fails) it **keeps showing the previous data** instead of a spinner (`keepPreviousData`, default on).

```tsx
// plain state
<AsyncView loading={loading} error={error} data={users} onRetry={reload}>
  {(users) => <UserTable users={users} />}
</AsyncView>

// SWR
<AsyncView query={useSWR('/api/orders', fetcher)}>{(orders) => <Orders data={orders} />}</AsyncView>

// custom views
<AsyncView
  query={query}
  loadingView={<Skeleton lines={5} />}
  errorView={(error, retry) => <MyError error={error} onRetry={retry} />}
  isEmpty={(page) => page.total === 0}
>
  {(page) => <Results page={page} />}
</AsyncView>
```

## Building blocks

```tsx
<LoadingState label="Fetching invoices…" />
<EmptyState icon={<InboxIcon />} title="Inbox zero" description="You're all caught up." action={<button>Compose</button>} />
<ErrorState error={error} onRetry={refetch} />
<Skeleton lines={3} />   <Skeleton circle height={48} />
```

All are accessible (`role="status"` / `role="alert"`, `aria-busy`, skeletons hidden from screen readers) and respect `prefers-reduced-motion`.

## Language & theme

```tsx
<StateViewsProvider labels="uz">        {/* 'en' | 'uz' | 'ru' | your own labels */}
  <App />
</StateViewsProvider>
```

```css
/* override colors */
.sv-state { --sv-accent: #16a34a; --sv-danger: #e11d48; }
```

Dark mode: add `data-theme="dark"` to any ancestor. Prefer your own CSS? `<StateViewsProvider unstyled>` renders plain markup with no injected styles.

## API

| Export | Description |
| --- | --- |
| `AsyncView` | `query` or `loading`/`error`/`data`, `isEmpty`, `onRetry`, `loadingView`, `emptyView`, `errorView`, `empty` (EmptyState props), `keepPreviousData`, `loadingDelay`, `children(data)` |
| `LoadingState` | `label`, `children` (replace spinner) |
| `EmptyState` | `icon`, `title`, `description`, `action` |
| `ErrorState` | `error`, `title`, `description`, `icon`, `onRetry`, `retryLabel`, `showMessage` |
| `Skeleton` | `lines`, `width`, `height`, `circle`, `gap` |
| `StateViewsProvider` | `labels`, `loadingDelay`, `unstyled` |
| `getErrorMessage(error)`, `isEmptyValue(value)` | Helpers |
| `labelsEn`, `labelsUz`, `labelsRu` | Label sets |

## License

MIT
