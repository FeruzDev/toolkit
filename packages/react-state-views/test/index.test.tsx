import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AsyncView, EmptyState, ErrorState, LoadingState, Skeleton, StateViewsProvider, getErrorMessage, isEmptyValue } from '../src';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const list = (items: string[]) => <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;

describe('AsyncView', () => {
  it('delays the loading view to avoid flicker', () => {
    render(<AsyncView loading data={undefined as string[] | undefined}>{list}</AsyncView>);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows error with retry, then empty, then data', () => {
    const retry = jest.fn();
    const { rerender } = render(<AsyncView error={new Error('Network down')} onRetry={retry}>{list}</AsyncView>);
    expect(screen.getByRole('alert').textContent).toContain('Network down');
    fireEvent.click(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalled();

    rerender(<AsyncView data={[] as string[]} empty={{ title: 'No projects', action: <button>Create</button> }}>{list}</AsyncView>);
    expect(screen.getByText('No projects')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();

    rerender(<AsyncView data={['a', 'b']}>{list}</AsyncView>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('works with a React Query-like result and keeps previous data while refetching', () => {
    const refetch = jest.fn();
    const { rerender } = render(<AsyncView query={{ isPending: false, data: ['x'], refetch }}>{list}</AsyncView>);
    expect(screen.getByText('x')).toBeTruthy();
    rerender(<AsyncView query={{ isLoading: true, data: ['x'], refetch }}>{list}</AsyncView>);
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByText('x')).toBeTruthy(); // no spinner over existing data
    rerender(<AsyncView query={{ error: new Error('boom'), data: undefined, refetch }}>{list}</AsyncView>);
    fireEvent.click(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('custom views and isEmpty', () => {
    render(
      <AsyncView data={{ total: 0, items: [] }} isEmpty={(d) => d.total === 0} emptyView={<p>Custom empty</p>}>
        {(d) => <p>{d.total}</p>}
      </AsyncView>,
    );
    expect(screen.getByText('Custom empty')).toBeTruthy();
  });
});

describe('building blocks & i18n', () => {
  it('uses Uzbek labels from the provider', () => {
    render(
      <StateViewsProvider labels="uz" loadingDelay={0}>
        <LoadingState />
        <EmptyState />
        <ErrorState onRetry={() => undefined} />
      </StateViewsProvider>,
    );
    expect(screen.getByText('Yuklanmoqda…')).toBeTruthy();
    expect(screen.getByText("Hozircha ma'lumot yo'q")).toBeTruthy();
    expect(screen.getByText('Qayta urinish')).toBeTruthy();
  });

  it('skeleton is hidden from screen readers', () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.querySelectorAll('.sv-skeleton')).toHaveLength(3);
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
  });

  it('helpers', () => {
    expect(getErrorMessage({ response: { data: { message: 'Email taken' } } })).toBe('Email taken');
    expect(getErrorMessage('x')).toBe('x');
    expect([isEmptyValue([]), isEmptyValue({}), isEmptyValue(new Map()), isEmptyValue(0), isEmptyValue([1])]).toEqual([true, true, true, false, false]);
  });
});
