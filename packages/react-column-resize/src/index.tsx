import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ColumnDef {
  id: string;
  /** Initial width, px. @default 150 */
  width?: number;
  /** @default 40 */
  minWidth?: number;
  /** @default Infinity */
  maxWidth?: number;
  /** Disable resizing for this column. */
  resizable?: boolean;
}

export interface UseColumnResizeOptions {
  columns: ColumnDef[];
  /** Persist widths in localStorage under this key. */
  storageKey?: string;
  /** Storage to use. @default window.localStorage */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** Called while dragging (`final: false`) and when done (`final: true`). */
  onChange?: (widths: Record<string, number>, final: boolean) => void;
  /** Keyboard step, px (Shift = ×5). @default 10 */
  step?: number;
  /** Text direction; in `rtl` dragging left makes columns wider. @default 'ltr' */
  dir?: 'ltr' | 'rtl';
}

export interface ResizeHandleProps {
  role: 'separator';
  tabIndex: number;
  'aria-orientation': 'vertical';
  'aria-label': string;
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax'?: number;
  'data-resizing'?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  style: React.CSSProperties;
}

export interface ColumnResize {
  /** Current widths by column id. */
  widths: Record<string, number>;
  /** Sum of all widths (use as table width with `table-layout: fixed`). */
  totalWidth: number;
  /** Id of the column being dragged. */
  resizing: string | null;
  /** Props for `<table>`: fixed layout and total width. */
  getTableProps: () => { style: React.CSSProperties };
  /** Props for `<col>` / `<th>` / grid cells: width style. */
  getColumnProps: (id: string) => { style: React.CSSProperties; 'data-column-id': string };
  /** Props for body cells (enables double-click auto-fit measuring). */
  getCellProps: (id: string) => { 'data-column-id': string };
  /** Props for the drag handle (spread on `<ResizeHandle>` or your own element). */
  getHandleProps: (id: string, label?: string) => ResizeHandleProps;
  setWidth: (id: string, width: number) => void;
  /** Fit a column to its widest content (header + cells with `getCellProps`). */
  autoFit: (id: string) => void;
  /** Restore initial widths (and clear storage). */
  reset: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Resizable columns with persistence — headless.
 *
 * @example
 * const resize = useColumnResize({
 *   storageKey: 'orders-table',
 *   columns: [{ id: 'name', width: 220, minWidth: 120 }, { id: 'status', width: 120 }, { id: 'total', width: 100 }],
 * });
 *
 * <table {...resize.getTableProps()}>
 *   <colgroup>{columns.map((c) => <col key={c.id} {...resize.getColumnProps(c.id)} />)}</colgroup>
 *   <thead><tr>
 *     <th style={{ position: 'relative' }}>Name <ResizeHandle {...resize.getHandleProps('name', 'Name')} /></th>
 *     …
 */
export function useColumnResize(options: UseColumnResizeOptions): ColumnResize {
  const { columns, storageKey, step = 10, dir = 'ltr' } = options;
  const storage = options.storage === undefined ? (typeof window !== 'undefined' ? window.localStorage : null) : options.storage;
  const optsRef = useRef(options);
  optsRef.current = options;

  const defs = useMemo(() => {
    const map: Record<string, Required<Omit<ColumnDef, 'id'>>> = {};
    for (const c of columns) {
      map[c.id] = { width: c.width ?? 150, minWidth: c.minWidth ?? 40, maxWidth: c.maxWidth ?? Infinity, resizable: c.resizable ?? true };
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(columns)]);

  const initial = useCallback(() => {
    const widths: Record<string, number> = {};
    for (const [id, d] of Object.entries(defs)) widths[id] = d.width;
    if (storageKey && storage) {
      try {
        const saved = JSON.parse(storage.getItem(storageKey) ?? '{}') as Record<string, number>;
        for (const [id, w] of Object.entries(saved)) {
          if (defs[id] && typeof w === 'number' && Number.isFinite(w)) widths[id] = clamp(w, defs[id].minWidth, defs[id].maxWidth);
        }
      } catch {
        /* ignore broken storage */
      }
    }
    return widths;
  }, [defs, storageKey, storage]);

  const [widths, setWidths] = useState<Record<string, number>>(initial);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const [resizing, setResizing] = useState<string | null>(null);

  // columns added/removed
  useEffect(() => {
    setWidths((prev) => {
      const base = initial();
      for (const id of Object.keys(base)) if (prev[id] !== undefined) base[id] = clamp(prev[id], defs[id].minWidth, defs[id].maxWidth);
      return base;
    });
  }, [defs, initial]);

  const persist = useCallback(
    (next: Record<string, number>) => {
      if (!storageKey || !storage) return;
      try {
        storage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota */
      }
    },
    [storageKey, storage],
  );

  const setWidth = useCallback(
    (id: string, width: number, final = true) => {
      const d = defs[id];
      if (!d) return;
      const next = { ...widthsRef.current, [id]: Math.round(clamp(width, d.minWidth, d.maxWidth)) };
      widthsRef.current = next;
      setWidths(next);
      optsRef.current.onChange?.(next, final);
      if (final) persist(next);
    },
    [defs, persist],
  );

  const autoFit = useCallback(
    (id: string) => {
      if (typeof document === 'undefined') return;
      const cells = document.querySelectorAll<HTMLElement>(`[data-column-id="${CSS.escape(id)}"]`);
      let max = 0;
      cells.forEach((cell) => {
        if (cell.tagName === 'COL') return;
        // measure content width without the current column constraint
        const range = document.createRange();
        range.selectNodeContents(cell);
        const contentWidth = range.getBoundingClientRect().width;
        const style = getComputedStyle(cell);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        max = Math.max(max, Math.ceil(contentWidth + padding), cell.scrollWidth);
      });
      if (max > 0) setWidth(id, max + 2);
    },
    [setWidth],
  );

  const reset = useCallback(() => {
    if (storageKey && storage) {
      try {
        storage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
    const base: Record<string, number> = {};
    for (const [id, d] of Object.entries(defs)) base[id] = d.width;
    widthsRef.current = base;
    setWidths(base);
    optsRef.current.onChange?.(base, true);
  }, [defs, storageKey, storage]);

  const startDrag = useCallback(
    (id: string, startX: number) => {
      const startWidth = widthsRef.current[id];
      const sign = dir === 'rtl' ? -1 : 1;
      setResizing(id);
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const move = (e: PointerEvent | MouseEvent) => setWidth(id, startWidth + sign * (e.clientX - startX), false);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
        setResizing(null);
        persist(widthsRef.current);
        optsRef.current.onChange?.(widthsRef.current, true);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [dir, persist, setWidth],
  );

  const totalWidth = Object.values(widths).reduce((a, b) => a + b, 0);

  return {
    widths,
    totalWidth,
    resizing,
    getTableProps: () => ({ style: { tableLayout: 'fixed', width: totalWidth } }),
    getColumnProps: (id) => ({ style: { width: widths[id], minWidth: widths[id], maxWidth: widths[id] }, 'data-column-id': id }),
    getCellProps: (id) => ({ 'data-column-id': id }),
    getHandleProps: (id, label) => {
      const d = defs[id];
      const enabled = d?.resizable !== false;
      return {
        role: 'separator',
        tabIndex: enabled ? 0 : -1,
        'aria-orientation': 'vertical',
        'aria-label': `Resize column ${label ?? id}`,
        'aria-valuenow': widths[id],
        'aria-valuemin': d?.minWidth ?? 0,
        'aria-valuemax': Number.isFinite(d?.maxWidth) ? d.maxWidth : undefined,
        'data-resizing': resizing === id || undefined,
        onPointerDown: (e) => {
          if (!enabled || (e.button !== undefined && e.button !== 0)) return;
          e.preventDefault();
          e.stopPropagation();
          startDrag(id, e.clientX);
        },
        onKeyDown: (e) => {
          if (!enabled) return;
          const s = e.shiftKey ? step * 5 : step;
          const towards = dir === 'rtl' ? -1 : 1;
          if (e.key === 'ArrowRight') setWidth(id, widths[id] + s * towards);
          else if (e.key === 'ArrowLeft') setWidth(id, widths[id] - s * towards);
          else if (e.key === 'Home') setWidth(id, d.minWidth);
          else if (e.key === 'End' && Number.isFinite(d.maxWidth)) setWidth(id, d.maxWidth);
          else if (e.key === 'Enter') autoFit(id);
          else return;
          e.preventDefault();
        },
        onDoubleClick: (e) => {
          if (!enabled) return;
          e.preventDefault();
          autoFit(id);
        },
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          // inside the cell, so `overflow: hidden` on headers (common for ellipsis) doesn't clip it
          [dir === 'rtl' ? 'left' : 'right']: 0,
          width: 8,
          cursor: enabled ? 'col-resize' : 'default',
          touchAction: 'none',
          zIndex: 1,
        },
      };
    },
    setWidth: (id, width) => setWidth(id, width),
    autoFit,
    reset,
  };
}

export interface ResizeHandleComponentProps extends Partial<ResizeHandleProps> {
  className?: string;
  /** Line color on hover / while dragging. @default '#3b82f6' */
  color?: string;
}

/**
 * Minimal visual handle. Place inside a `position: relative` header cell.
 *
 * @example
 * <th style={{ position: 'relative' }}>Name <ResizeHandle {...resize.getHandleProps('name')} /></th>
 */
export function ResizeHandle({ className, color = '#3b82f6', style, ...props }: ResizeHandleComponentProps) {
  const [hover, setHover] = useState(false);
  const active = hover || props['data-resizing'];
  return (
    <div
      {...props}
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{ ...style, display: 'flex', justifyContent: 'center', outline: 'none' }}
    >
      <span style={{ width: 2, height: '100%', background: active ? color : 'transparent', transition: 'background 0.15s' }} />
    </div>
  );
}
