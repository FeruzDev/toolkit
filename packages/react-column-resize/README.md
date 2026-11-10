# react-column-resize

[![npm](https://img.shields.io/npm/v/react-column-resize.svg)](https://www.npmjs.com/package/react-column-resize)
[![size](https://img.shields.io/bundlephobia/minzip/react-column-resize)](https://bundlephobia.com/package/react-column-resize)

**Resizable table columns that remember their width.** A small headless hook + optional handle component: drag, keyboard, double-click to auto-fit, min/max widths and localStorage persistence. Works with a plain `<table>`, CSS grid, or any table library (TanStack Table, AG Grid-free setups…).

```tsx
import { useColumnResize, ResizeHandle } from 'react-column-resize';

const columns = [
  { id: 'name', width: 220, minWidth: 120 },
  { id: 'email', width: 260 },
  { id: 'status', width: 120, maxWidth: 200 },
];

function UsersTable({ users }: { users: User[] }) {
  const resize = useColumnResize({ columns, storageKey: 'users-table' });

  return (
    <table {...resize.getTableProps()}>
      <colgroup>
        {columns.map((c) => <col key={c.id} {...resize.getColumnProps(c.id)} />)}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.id} style={{ position: 'relative' }} {...resize.getCellProps(c.id)}>
              {c.id}
              <ResizeHandle {...resize.getHandleProps(c.id, c.id)} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td {...resize.getCellProps('name')}>{u.name}</td>
            <td {...resize.getCellProps('email')}>{u.email}</td>
            <td {...resize.getCellProps('status')}>{u.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Tip: give cells `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` so narrow columns truncate nicely.

## Install

```bash
npm install react-column-resize
```

## Interactions

| Action | Result |
| --- | --- |
| Drag the handle | Resize (clamped to `minWidth`/`maxWidth`), pointer events — mouse, touch, pen |
| Double-click the handle / `Enter` | Auto-fit to the widest content (cells with `getCellProps`) |
| `←` / `→` (focus the handle) | −/+ 10 px (`Shift` = 50 px) |
| `Home` / `End` | Min / max width |
| `reset()` | Initial widths, clears storage |

Widths are saved to `localStorage` when a drag ends (not on every mouse move). Saved values are validated and clamped, and columns that no longer exist are ignored. Handles are `role="separator"` with `aria-valuenow/min/max`.

## API

`useColumnResize({ columns, storageKey?, storage?, onChange?, step?, dir? })`

Columns: `{ id, width = 150, minWidth = 40, maxWidth = Infinity, resizable = true }`.

Returns:

| Field | Description |
| --- | --- |
| `widths` | `{ [id]: px }` |
| `totalWidth` | Sum of widths |
| `resizing` | Column id being dragged, or `null` |
| `getTableProps()` | `table-layout: fixed` + total width |
| `getColumnProps(id)` | Width style for `<col>`/`<th>`/grid cells |
| `getCellProps(id)` | Marks cells for auto-fit measuring |
| `getHandleProps(id, label?)` | Drag/keyboard/a11y props for the handle |
| `setWidth(id, px)`, `autoFit(id)`, `reset()` | Imperative control |

`onChange(widths, final)` fires during drags (`final: false`) and when done (`final: true`) — sync to your backend for per-user layouts.

`<ResizeHandle color?>` renders a thin line on hover/drag; or spread `getHandleProps` onto your own element.

### CSS grid

```tsx
<div style={{ display: 'grid', gridTemplateColumns: columns.map((c) => `${resize.widths[c.id]}px`).join(' ') }}>…</div>
```

## License

MIT
