import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { parseAnsi, stripAnsi, hasAnsi, type Segment } from './ansi';

export { parseAnsi, stripAnsi } from './ansi';
export type { Segment } from './ansi';

/** Browsers cap element height (~17.9M px in Firefox, ~33M px in Chrome). Above this we scale the scrollbar. */
const MAX_SCROLL_HEIGHT = 8_000_000;

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_RE: Array<[LogLevel, RegExp]> = [
  ['error', /\b(ERROR|ERR|FATAL|CRITICAL|PANIC)\b|\[E\]/],
  ['warn', /\b(WARN|WARNING)\b|\[W\]/],
  ['debug', /\b(DEBUG|TRACE|VERBOSE)\b|\[D\]/],
  ['info', /\b(INFO|NOTICE)\b|\[I\]/],
];

/** Detect a log level from text (ERROR/WARN/INFO/DEBUG…). */
export function detectLevel(line: string): LogLevel | undefined {
  for (const [level, re] of LEVEL_RE) if (re.test(line)) return level;
  return undefined;
}

export interface LogTheme {
  background: string;
  color: string;
  gutter: string;
  gutterColor: string;
  highlight: string;
  selected: string;
  error: string;
  warn: string;
  debug: string;
  info: string;
}

export const darkTheme: LogTheme = {
  background: '#0d1117',
  color: '#c9d1d9',
  gutter: '#0d1117',
  gutterColor: '#6e7681',
  highlight: 'rgba(250, 204, 21, 0.45)',
  selected: 'rgba(56, 139, 253, 0.25)',
  error: '#ff7b72',
  warn: '#e3b341',
  debug: '#8b949e',
  info: '#c9d1d9',
};

export const lightTheme: LogTheme = {
  background: '#ffffff',
  color: '#1f2328',
  gutter: '#f6f8fa',
  gutterColor: '#8c959f',
  highlight: 'rgba(250, 204, 21, 0.6)',
  selected: 'rgba(84, 174, 255, 0.25)',
  error: '#cf222e',
  warn: '#9a6700',
  debug: '#6e7781',
  info: '#1f2328',
};

export interface LogViewerProps {
  /** All lines. May be a mutable array (e.g. from `useLogBuffer`); pass `lineCount` so updates re-render. */
  lines: readonly string[];
  /** Number of lines to show. @default lines.length */
  lineCount?: number;
  /** Viewer height (px or CSS). @default 400 */
  height?: number | string;
  /** Row height in px (rows do not wrap). @default 20 */
  rowHeight?: number;
  /** Keep scrolled to the bottom while new lines arrive (stops when the user scrolls up). @default true */
  follow?: boolean;
  /** Highlight matches (string = case-insensitive text, or RegExp). */
  search?: string | RegExp;
  /** Color whole lines by level (ERROR, WARN, DEBUG…). @default true */
  colorLevels?: boolean;
  /** Render ANSI colors (`\x1b[31m`). `false` strips codes. @default true */
  ansi?: boolean;
  /** @default true */
  showLineNumbers?: boolean;
  /** Number of the first line (e.g. after trimming). @default 1 */
  firstLineNumber?: number;
  /** Highlight a line (0-based index). */
  selectedLine?: number;
  onLineClick?: (index: number, line: string) => void;
  /** Called when follow mode changes (user scrolled up / back to bottom). */
  onFollowChange?: (following: boolean) => void;
  /** `'dark'`, `'light'` or a full theme object. @default 'dark' */
  theme?: 'dark' | 'light' | LogTheme;
  /** Extra rows rendered above/below the viewport. @default 10 */
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Shown when there are no lines. */
  empty?: React.ReactNode;
  'aria-label'?: string;
}

export interface LogViewerHandle {
  scrollToLine: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToBottom: () => void;
  scrollToTop: () => void;
  /** Is the viewer currently following the end? */
  isFollowing: () => boolean;
}

function highlight(text: string, search: RegExp | null, mark: string, keyBase: string, style?: React.CSSProperties): React.ReactNode[] {
  if (!search) return [<span key={keyBase} style={style}>{text}</span>];
  const out: React.ReactNode[] = [];
  let last = 0;
  search.lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = search.exec(text))) {
    if (m[0] === '') {
      search.lastIndex++;
      continue;
    }
    if (m.index > last) out.push(<span key={`${keyBase}-${i++}`} style={style}>{text.slice(last, m.index)}</span>);
    out.push(
      <mark key={`${keyBase}-${i++}`} style={{ ...style, background: mark, color: 'inherit', borderRadius: 2 }}>
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={`${keyBase}-${i++}`} style={style}>{text.slice(last)}</span>);
  return out;
}

const segmentStyle = (s: Segment): React.CSSProperties | undefined =>
  s.color || s.background || s.bold || s.dim || s.italic || s.underline
    ? {
        color: s.color,
        background: s.background,
        fontWeight: s.bold ? 700 : undefined,
        opacity: s.dim ? 0.7 : undefined,
        fontStyle: s.italic ? 'italic' : undefined,
        textDecoration: s.underline ? 'underline' : undefined,
      }
    : undefined;

interface RowProps {
  text: string;
  index: number;
  number: number;
  top: number;
  rowHeight: number;
  gutterWidth: number;
  showNumbers: boolean;
  search: RegExp | null;
  ansi: boolean;
  colorLevels: boolean;
  selected: boolean;
  theme: LogTheme;
  onClick?: (index: number, line: string) => void;
}

const Row = memo(function Row(p: RowProps) {
  const containsAnsi = hasAnsi(p.text);
  const plain = containsAnsi ? stripAnsi(p.text) : p.text;
  const level = p.colorLevels && !(p.ansi && containsAnsi) ? detectLevel(plain) : undefined;
  const content =
    p.ansi && containsAnsi
      ? parseAnsi(p.text).flatMap((seg, i) => highlight(seg.text, p.search, p.theme.highlight, `s${i}`, segmentStyle(seg)))
      : highlight(plain, p.search, p.theme.highlight, 't');

  return (
    <div
      role="row"
      aria-rowindex={p.index + 1}
      data-index={p.index}
      onClick={p.onClick ? () => p.onClick!(p.index, plain) : undefined}
      style={{
        position: 'absolute',
        top: p.top,
        left: 0,
        right: 0,
        height: p.rowHeight,
        lineHeight: `${p.rowHeight}px`,
        display: 'flex',
        whiteSpace: 'pre',
        background: p.selected ? p.theme.selected : undefined,
        color: level ? p.theme[level] : undefined,
        cursor: p.onClick ? 'pointer' : undefined,
      }}
    >
      {p.showNumbers && (
        <span
          role="rowheader"
          style={{
            position: 'sticky',
            left: 0,
            flex: `0 0 ${p.gutterWidth}px`,
            textAlign: 'right',
            paddingRight: 12,
            color: p.theme.gutterColor,
            background: p.theme.gutter,
            userSelect: 'none',
          }}
        >
          {p.number}
        </span>
      )}
      <span role="cell" style={{ paddingLeft: p.showNumbers ? 0 : 8, paddingRight: 16 }}>
        {content}
      </span>
    </div>
  );
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Virtualized log viewer for millions of lines.
 *
 * @example
 * const log = useLogBuffer({ maxLines: 1_000_000 });
 * useEffect(() => {
 *   const ws = new WebSocket(url);
 *   ws.onmessage = (e) => log.append(e.data);
 *   return () => ws.close();
 * }, []);
 * return <LogViewer lines={log.lines} lineCount={log.count} height={500} search={query} />;
 */
export const LogViewer = forwardRef<LogViewerHandle, LogViewerProps>(function LogViewer(props, ref) {
  const {
    lines,
    lineCount = lines.length,
    height = 400,
    rowHeight = 20,
    follow = true,
    search,
    colorLevels = true,
    ansi = true,
    showLineNumbers = true,
    firstLineNumber = 1,
    selectedLine,
    onLineClick,
    onFollowChange,
    theme = 'dark',
    overscan = 10,
    className,
    style,
    empty,
  } = props;

  const t = theme === 'dark' ? darkTheme : theme === 'light' ? lightTheme : theme;
  const container = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(typeof height === 'number' ? height : 400);
  const following = useRef(follow);
  const programmatic = useRef(false);

  const count = Math.min(lineCount, lines.length);
  const realHeight = count * rowHeight;
  const scrollHeight = Math.min(realHeight, MAX_SCROLL_HEIGHT);
  const maxScroll = Math.max(0, scrollHeight - viewport);
  const maxReal = Math.max(0, realHeight - viewport);
  // map scrollbar position → real pixel offset (1:1 unless we exceed the browser limit)
  const ratio = maxScroll > 0 ? maxReal / maxScroll : 1;
  const realOffset = Math.min(maxReal, scrollTop * ratio);

  const first = Math.max(0, Math.floor(realOffset / rowHeight) - overscan);
  const last = Math.min(count - 1, Math.ceil((realOffset + viewport) / rowHeight) + overscan);
  const gutterWidth = showLineNumbers ? String(firstLineNumber + count).length * 8 + 20 : 0;

  const searchRe = useMemo(() => {
    if (!search) return null;
    if (search instanceof RegExp) return new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`);
    return search.trim() ? new RegExp(escapeRe(search), 'gi') : null;
  }, [search]);

  // measure viewport
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return undefined;
    const update = () => setViewport(el.clientHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollToReal = useCallback(
    (offset: number) => {
      const el = container.current;
      if (!el) return;
      const target = ratio > 0 ? Math.round(Math.max(0, Math.min(maxReal, offset)) / ratio) : 0;
      programmatic.current = true;
      el.scrollTop = target;
      setScrollTop(target);
    },
    [ratio, maxReal],
  );

  const setFollowing = (value: boolean) => {
    if (following.current !== value) {
      following.current = value;
      onFollowChange?.(value);
    }
  };

  // follow: stick to the bottom when new lines arrive
  useLayoutEffect(() => {
    if (follow && following.current) scrollToReal(maxReal);
  }, [count, follow, maxReal, scrollToReal]);

  // lines dropped from the start (maxLines): keep the same lines in view while the user reads
  const prevFirst = useRef(firstLineNumber);
  useLayoutEffect(() => {
    const delta = firstLineNumber - prevFirst.current;
    prevFirst.current = firstLineNumber;
    if (delta > 0 && !(follow && following.current)) scrollToReal(realOffset - delta * rowHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLineNumber]);

  useEffect(() => {
    if (!follow) setFollowing(false);
    else if (follow && container.current && scrollTop >= maxScroll - 2) setFollowing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    if (follow) setFollowing(top >= maxScroll - rowHeight / 2);
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine: (index, align = 'start') => {
        const offset = index * rowHeight - (align === 'center' ? (viewport - rowHeight) / 2 : align === 'end' ? viewport - rowHeight : 0);
        setFollowing(false);
        scrollToReal(offset);
      },
      scrollToBottom: () => {
        setFollowing(true);
        scrollToReal(maxReal);
      },
      scrollToTop: () => {
        setFollowing(false);
        scrollToReal(0);
      },
      isFollowing: () => following.current,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowHeight, viewport, maxReal, scrollToReal],
  );

  const rows: React.ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    rows.push(
      <Row
        key={i}
        text={lines[i] ?? ''}
        index={i}
        number={firstLineNumber + i}
        top={i * rowHeight - realOffset + scrollTop}
        rowHeight={rowHeight}
        gutterWidth={gutterWidth}
        showNumbers={showLineNumbers}
        search={searchRe}
        ansi={ansi}
        colorLevels={colorLevels}
        selected={selectedLine === i}
        theme={t}
        onClick={onLineClick}
      />,
    );
  }

  return (
    <div
      ref={container}
      role="grid"
      aria-label={props['aria-label'] ?? 'Log output'}
      aria-rowcount={count}
      tabIndex={0}
      className={className}
      onScroll={onScroll}
      style={{
        position: 'relative',
        height,
        overflow: 'auto',
        background: t.background,
        color: t.color,
        font: '12.5px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        outline: 'none',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: Math.max(scrollHeight, 1), minWidth: '100%', width: 'max-content' }}>{rows}</div>
      {count === 0 && empty !== undefined && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>{empty}</div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* streaming buffer                                                    */
/* ------------------------------------------------------------------ */

export interface LogBufferOptions {
  /** Keep at most this many lines (oldest are dropped). @default 100000 */
  maxLines?: number;
  /** Batch appends into one render every N ms. @default 50 */
  flushInterval?: number;
}

export interface LogBuffer {
  /** Mutable array of lines — pass with `lineCount={count}`. */
  lines: string[];
  count: number;
  /** Lines dropped from the start because of `maxLines` (use for `firstLineNumber`). */
  dropped: number;
  /** Append complete lines: a string (split on newlines) or an array. Use for WebSocket/SSE messages. */
  append: (chunk: string | string[]) => void;
  /** Append raw stream data; an unfinished last line is kept until the next chunk (fetch/stdout streams). */
  appendStream: (chunk: string) => void;
  clear: () => void;
}

/**
 * Efficient line buffer for streaming logs (WebSocket, SSE, fetch streams).
 * Appends are batched; the array is mutated in place to avoid copying millions of strings.
 */
export function useLogBuffer(options: LogBufferOptions = {}): LogBuffer {
  const { maxLines = 100_000, flushInterval = 50 } = options;
  const lines = useRef<string[]>([]);
  const partial = useRef('');
  const dropped = useRef(0);
  const [, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      const arr = lines.current;
      if (arr.length > maxLines) {
        // trim in chunks (10% slack) so we don't shift a huge array on every append
        const remove = arr.length - Math.floor(maxLines * 0.9);
        arr.splice(0, remove);
        dropped.current += remove;
      }
      setVersion((v) => v + 1);
    }, flushInterval);
  }, [maxLines, flushInterval]);

  const append = useCallback(
    (chunk: string | string[]) => {
      const parts = Array.isArray(chunk) ? chunk : chunk.split(/\r?\n/);
      if (!Array.isArray(chunk) && parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
      for (const l of parts) lines.current.push(l);
      schedule();
    },
    [schedule],
  );

  const appendStream = useCallback(
    (chunk: string) => {
      const parts = (partial.current + chunk).split(/\r?\n/);
      partial.current = parts.pop() ?? '';
      for (const l of parts) lines.current.push(l);
      schedule();
    },
    [schedule],
  );

  const clear = useCallback(() => {
    lines.current.length = 0;
    partial.current = '';
    dropped.current = 0;
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { lines: lines.current, count: lines.current.length, dropped: dropped.current, append, appendStream, clear };
}
