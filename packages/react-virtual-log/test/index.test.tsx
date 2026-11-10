import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { LogViewer, useLogBuffer, parseAnsi, stripAnsi, detectLevel } from '../src';

describe('ansi', () => {
  it('parses colors and styles', () => {
    expect(parseAnsi('\x1b[31mred\x1b[0m plain \x1b[1;32mbold green\x1b[39m')).toEqual([
      { text: 'red', color: '#f14c4c' },
      { text: ' plain ' },
      { text: 'bold green', bold: true, color: '#23d18b' },
    ]);
    expect(parseAnsi('\x1b[38;5;196mx')[0].color).toBe('rgb(255,0,0)');
    expect(parseAnsi('\x1b[38;2;1;2;3mx')[0].color).toBe('rgb(1,2,3)');
    expect(stripAnsi('\x1b[2K\x1b[31merr\x1b[0m')).toBe('err');
  });

  it('detects levels', () => {
    expect(detectLevel('2026-01-01 ERROR db down')).toBe('error');
    expect(detectLevel('[W] slow query')).toBe('warn');
    expect(detectLevel('DEBUG cache hit')).toBe('debug');
    expect(detectLevel('hello')).toBeUndefined();
  });
});

describe('LogViewer', () => {
  const million = Array.from({ length: 1_000_000 }, (_, i) => `line ${i} ${i % 1000 === 0 ? 'ERROR boom' : 'ok'}`);

  it('renders only a small window of a million lines', () => {
    const { container } = render(<LogViewer lines={million} height={300} follow={false} />);
    const rows = container.querySelectorAll('[role="row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(60);
    expect(rows[0].textContent).toBe('1line 0 ERROR boom');
    expect(container.querySelector('[role="grid"]')!.getAttribute('aria-rowcount')).toBe('1000000');
    // spacer is capped below browser height limits
    const spacer = container.querySelector('[role="grid"] > div') as HTMLElement;
    expect(parseInt(spacer.style.height, 10)).toBeLessThanOrEqual(8_000_000);
  });

  it('highlights search matches and handles clicks', () => {
    const onLineClick = jest.fn();
    const { container } = render(<LogViewer lines={['alpha beta', 'Beta gamma']} search="beta" onLineClick={onLineClick} follow={false} />);
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['beta', 'Beta']);
    fireEvent.click(container.querySelectorAll('[role="row"]')[1]);
    expect(onLineClick).toHaveBeenCalledWith(1, 'Beta gamma');
  });

  it('renders ANSI colors and level colors', () => {
    const { container } = render(<LogViewer lines={['\x1b[32mgreen\x1b[0m', 'ERROR x']} follow={false} showLineNumbers={false} />);
    const rows = container.querySelectorAll('[role="row"]');
    expect((rows[0].querySelector('span span') as HTMLElement).style.color).toBe('rgb(35, 209, 139)');
    expect((rows[1] as HTMLElement).style.color).toBe('rgb(255, 123, 114)');
  });

  it('shows the empty state', () => {
    const { getByText } = render(<LogViewer lines={[]} empty="No logs yet" />);
    expect(getByText('No logs yet')).toBeTruthy();
  });
});

describe('useLogBuffer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('appends lines, batches renders and trims to maxLines', () => {
    const { result } = renderHook(() => useLogBuffer({ maxLines: 100, flushInterval: 10 }));
    act(() => {
      result.current.append('a\nb\n');
      result.current.append(['c', 'd']);
    });
    expect(result.current.count).toBe(0); // not flushed yet
    act(() => jest.advanceTimersByTime(10));
    expect(result.current.lines.slice(0, result.current.count)).toEqual(['a', 'b', 'c', 'd']);

    act(() => {
      result.current.append(Array.from({ length: 200 }, (_, i) => `x${i}`));
      jest.advanceTimersByTime(10);
    });
    expect(result.current.count).toBe(90);
    expect(result.current.dropped).toBe(114);
    expect(result.current.lines[result.current.count - 1]).toBe('x199');
  });

  it('appendStream joins partial lines across chunks', () => {
    const { result } = renderHook(() => useLogBuffer({ flushInterval: 1 }));
    act(() => {
      result.current.appendStream('hel');
      result.current.appendStream('lo\nwor');
      result.current.appendStream('ld\n');
      jest.advanceTimersByTime(1);
    });
    expect(result.current.lines.slice(0, result.current.count)).toEqual(['hello', 'world']);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });
});
