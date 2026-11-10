import React, { useState } from 'react';
import { act, render, fireEvent } from '@testing-library/react';
import { announce, resetAnnouncer, useAnnounceOnChange, useLiveAnnouncer } from '../src';

const region = (p: 'polite' | 'assertive') => document.getElementById(`live-announcer-${p}`);

beforeEach(() => {
  jest.useFakeTimers();
  resetAnnouncer();
});
afterEach(() => jest.useRealTimers());

describe('announce', () => {
  it('creates accessible hidden regions and sets text', () => {
    announce('3 new orders');
    act(() => jest.advanceTimersByTime(60));
    const el = region('polite')!;
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toBe('3 new orders');
    act(() => jest.advanceTimersByTime(7000));
    expect(el.textContent).toBe('');
  });

  it('uses a separate assertive region for alarms', () => {
    announce('CPU 99%', { politeness: 'assertive' });
    act(() => jest.advanceTimersByTime(60));
    expect(region('assertive')!.getAttribute('role')).toBe('alert');
    expect(region('assertive')!.textContent).toBe('CPU 99%');
    expect(region('polite')).toBeNull();
  });

  it('re-announces the same message by clearing first', () => {
    announce('Saved');
    act(() => jest.advanceTimersByTime(60));
    announce('Saved');
    expect(region('polite')!.textContent).toBe('');
    act(() => jest.advanceTimersByTime(60));
    expect(region('polite')!.textContent).toBe('Saved');
  });
});

describe('hooks', () => {
  it('useLiveAnnouncer', () => {
    function Btn() {
      const { announceAssertive } = useLiveAnnouncer();
      return <button onClick={() => announceAssertive('Alarm!')}>go</button>;
    }
    const { getByText } = render(<Btn />);
    fireEvent.click(getByText('go'));
    act(() => jest.advanceTimersByTime(60));
    expect(region('assertive')!.textContent).toBe('Alarm!');
  });

  it('useAnnounceOnChange skips initial value, filters and throttles', () => {
    function Dash() {
      const [n, setN] = useState(0);
      useAnnounceOnChange(n, (v) => `${v} active alarms`, { when: (v, prev) => v > (prev ?? 0), throttle: 1000 });
      return (
        <>
          <button onClick={() => setN((x) => x + 1)}>inc</button>
          <button onClick={() => setN((x) => x - 1)}>dec</button>
        </>
      );
    }
    const { getByText } = render(<Dash />);
    act(() => jest.advanceTimersByTime(100));
    expect(region('polite')).toBeNull(); // nothing on mount

    fireEvent.click(getByText('inc'));
    act(() => jest.advanceTimersByTime(60));
    expect(region('polite')!.textContent).toBe('1 active alarms');

    fireEvent.click(getByText('inc'));
    fireEvent.click(getByText('inc'));
    act(() => jest.advanceTimersByTime(100));
    expect(region('polite')!.textContent).toBe('1 active alarms'); // throttled
    act(() => jest.advanceTimersByTime(1000));
    expect(region('polite')!.textContent).toBe('3 active alarms'); // merged into one

    fireEvent.click(getByText('dec'));
    act(() => jest.advanceTimersByTime(2000));
    expect(region('polite')!.textContent).toBe('3 active alarms'); // filtered by `when`
  });
});
