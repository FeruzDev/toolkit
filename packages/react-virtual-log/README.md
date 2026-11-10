# react-virtual-log

[![npm](https://img.shields.io/npm/v/react-virtual-log.svg)](https://www.npmjs.com/package/react-virtual-log)
[![size](https://img.shields.io/bundlephobia/minzip/react-virtual-log)](https://bundlephobia.com/package/react-virtual-log)

**A React log viewer that stays fast with millions of lines.** Virtualized rendering (only ~30 DOM rows), tail/follow mode, search highlighting, ANSI terminal colors, log-level coloring, line numbers, and a streaming buffer hook for WebSocket/SSE/fetch logs.

```tsx
import { LogViewer, useLogBuffer } from 'react-virtual-log';

function BuildLogs({ url }: { url: string }) {
  const log = useLogBuffer({ maxLines: 500_000 });
  const [query, setQuery] = useState('');

  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => log.append(e.data);
    return () => ws.close();
  }, [url]);

  return (
    <>
      <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <LogViewer lines={log.lines} lineCount={log.count} firstLineNumber={log.dropped + 1} height={500} search={query} />
    </>
  );
}
```

## Install

```bash
npm install react-virtual-log
```

## Highlights

- **Millions of lines**: browsers cap element height (~17.9M px in Firefox), so plain virtual lists break around 1M rows. The scrollbar is scaled above 8M px, so line 1,000,000 is reachable and scrolling stays smooth.
- **Follow / tail mode**: sticks to the bottom as lines arrive; scrolling up pauses it, scrolling back to the end resumes (`onFollowChange`). When old lines are trimmed, the lines you are reading stay in place.
- **ANSI colors**: 16/256/true-color, bold, dim, italic, underline (`\x1b[31m…`). Other escape codes are stripped.
- **Levels**: lines with `ERROR`, `WARN`, `DEBUG`… are tinted (turn off with `colorLevels={false}`).
- **Search**: case-insensitive text or a `RegExp`, highlighted in visible lines.
- **Accessible**: `role="grid"` with row count, keyboard-focusable.
- Dark and light themes, or your own theme object.

## `<LogViewer />` props

| Prop | Default | Description |
| --- | --- | --- |
| `lines` | required | `string[]` (can be the mutable array from `useLogBuffer`) |
| `lineCount` | `lines.length` | Number of lines to show — pass it when the array is mutated |
| `height` | `400` | px or CSS value |
| `rowHeight` | `20` | Fixed row height, px (no wrapping) |
| `follow` | `true` | Enable tail mode |
| `search` | – | `string` or `RegExp` |
| `ansi` | `true` | Render ANSI colors (`false` strips them) |
| `colorLevels` | `true` | Tint ERROR/WARN/DEBUG lines |
| `showLineNumbers` | `true` | Gutter |
| `firstLineNumber` | `1` | Number of the first line |
| `selectedLine` | – | Highlighted line index |
| `onLineClick(index, text)` | – | Click handler |
| `onFollowChange(following)` | – | Follow mode toggled |
| `theme` | `'dark'` | `'dark' \| 'light' \| LogTheme` |
| `overscan` | `10` | Extra rows rendered |
| `empty` | – | Content when there are no lines |

Ref methods: `scrollToLine(index, 'start' | 'center' | 'end')`, `scrollToBottom()`, `scrollToTop()`, `isFollowing()`.

## `useLogBuffer({ maxLines, flushInterval })`

Returns `{ lines, count, dropped, append, appendStream, clear }`.

- `append(text | string[])` — complete lines (WebSocket/SSE messages). Strings are split on newlines.
- `appendStream(chunk)` — raw stream data (fetch body, process output); an unfinished last line waits for the next chunk.
- Appends are batched (`flushInterval`, default 50 ms) and the array is mutated in place — no copying of millions of strings.
- `maxLines` (default 100,000) trims the oldest lines in chunks; `dropped` tells how many.

```ts
// streaming a fetch response
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  log.appendStream(value);
}
```

Utilities: `parseAnsi(text)`, `stripAnsi(text)`, `detectLevel(text)`.

## License

MIT
