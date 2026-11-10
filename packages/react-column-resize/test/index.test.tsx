import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useColumnResize, ResizeHandle, type ColumnDef } from '../src';

// jsdom may not implement PointerEvent
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error minimal polyfill for tests
  window.PointerEvent = class extends MouseEvent {};
}

const columns: ColumnDef[] = [
  { id: 'name', width: 200, minWidth: 100, maxWidth: 400 },
  { id: 'status', width: 120 },
  { id: 'id', width: 60, resizable: false },
];

function Table({ onChange, storageKey = 'cols' }: { onChange?: (w: Record<string, number>, f: boolean) => void; storageKey?: string }) {
  const r = useColumnResize({ columns, storageKey, onChange });
  return (
    <>
      <table {...r.getTableProps()}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.id} {...r.getColumnProps(c.id)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.id} style={{ position: 'relative' }}>
                {c.id}
                <ResizeHandle {...r.getHandleProps(c.id)} />
              </th>
            ))}
          </tr>
        </thead>
      </table>
      <output data-testid="w">{JSON.stringify(r.widths)}</output>
      <output data-testid="total">{r.totalWidth}</output>
      <button onClick={r.reset}>reset</button>
    </>
  );
}

const widths = () => JSON.parse(screen.getByTestId('w').textContent!);
const handle = (id: string) => screen.getByLabelText(`Resize column ${id}`);

beforeEach(() => localStorage.clear());

describe('useColumnResize', () => {
  it('drags with min/max clamping and persists on release', () => {
    const onChange = jest.fn();
    render(<Table onChange={onChange} />);
    expect(screen.getByTestId('total').textContent).toBe('380');

    fireEvent.pointerDown(handle('name'), { clientX: 500, button: 0 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 550 }));
    });
    expect(widths().name).toBe(250);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 250 }), false);
    expect(localStorage.getItem('cols')).toBeNull(); // not persisted while dragging

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 2000 }));
    });
    expect(widths().name).toBe(400); // max
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(JSON.parse(localStorage.getItem('cols')!).name).toBe(400);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 400 }), true);
    expect(document.body.style.cursor).toBe('');
  });

  it('restores persisted widths and resets', () => {
    localStorage.setItem('cols', JSON.stringify({ name: 999, status: 150, removed: 50 }));
    render(<Table />);
    expect(widths()).toEqual({ name: 400, status: 150, id: 60 }); // clamped, unknown ignored
    fireEvent.click(screen.getByText('reset'));
    expect(widths()).toEqual({ name: 200, status: 120, id: 60 });
    expect(localStorage.getItem('cols')).toBeNull();
  });

  it('keyboard resizing and accessibility attributes', () => {
    render(<Table />);
    const h = handle('status');
    expect(h.getAttribute('role')).toBe('separator');
    expect(h.getAttribute('aria-valuenow')).toBe('120');
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    fireEvent.keyDown(h, { key: 'ArrowRight', shiftKey: true });
    expect(widths().status).toBe(180);
    fireEvent.keyDown(h, { key: 'Home' });
    expect(widths().status).toBe(40);
  });

  it('non-resizable columns ignore input', () => {
    render(<Table />);
    const h = handle('id');
    expect(h.getAttribute('tabindex')).toBe('-1');
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    fireEvent.pointerDown(h, { clientX: 0, button: 0 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    expect(widths().id).toBe(60);
  });
});
