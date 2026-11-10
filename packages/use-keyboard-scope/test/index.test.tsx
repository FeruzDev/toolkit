import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HotkeyScope, useHotkey, useHotkeyList, useActiveScope, formatHotkey, parseHotkey } from '../src';

const press = (key: string, init: KeyboardEventInit = {}, target: Element | Window = window) => {
  act(() => {
    fireEvent.keyDown(target, { key, ...init });
  });
};

function Page({ onSearch, onEsc }: { onSearch: () => void; onEsc: () => void }) {
  useHotkey('ctrl+k', onSearch, { description: 'Search' });
  useHotkey('escape', onEsc);
  return null;
}

function Modal({ onEsc, onSave }: { onEsc: () => void; onSave: () => void }) {
  useHotkey('escape', onEsc, { description: 'Close' });
  useHotkey(['ctrl+s', 'meta+s'], onSave, { description: 'Save' });
  return <input data-testid="field" />;
}

function HelpList() {
  const list = useHotkeyList();
  const scope = useActiveScope();
  return <div data-testid="help">{`${scope ?? 'global'}: ${list.map((h) => h.description ?? h.hotkey).join(', ')}`}</div>;
}

function App(props: { onSearch: () => void; pageEsc: () => void; modalEsc: () => void; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)}>toggle</button>
      <Page onSearch={props.onSearch} onEsc={props.pageEsc} />
      <HotkeyScope name="modal" active={open}>
        {open && <Modal onEsc={props.modalEsc} onSave={props.onSave} />}
      </HotkeyScope>
      <HelpList />
    </>
  );
}

describe('use-keyboard-scope', () => {
  it('scopes block global hotkeys and restore them on close', () => {
    const fns = { onSearch: jest.fn(), pageEsc: jest.fn(), modalEsc: jest.fn(), onSave: jest.fn() };
    render(<App {...fns} />);

    press('k', { ctrlKey: true });
    press('Escape');
    expect(fns.onSearch).toHaveBeenCalledTimes(1);
    expect(fns.pageEsc).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('help').textContent).toBe('global: Search, escape');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('help').textContent).toBe('modal: Close, Save, Save');
    press('Escape');
    press('k', { ctrlKey: true });
    expect(fns.modalEsc).toHaveBeenCalledTimes(1);
    expect(fns.pageEsc).toHaveBeenCalledTimes(1); // blocked
    expect(fns.onSearch).toHaveBeenCalledTimes(1); // blocked

    // ctrl+s works even while typing in the modal input
    press('s', { ctrlKey: true }, screen.getByTestId('field'));
    expect(fns.onSave).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('toggle'));
    press('Escape');
    expect(fns.pageEsc).toHaveBeenCalledTimes(2);
  });

  it('supports sequences and non-Latin layouts, ignores plain keys in inputs', () => {
    const go = jest.fn();
    const palette = jest.fn();
    const help = jest.fn();
    function C() {
      useHotkey('g i', go);
      useHotkey('ctrl+k', palette);
      useHotkey('?', help);
      return <input data-testid="in" />;
    }
    render(<C />);
    press('g');
    press('i');
    expect(go).toHaveBeenCalledTimes(1);

    press('л', { ctrlKey: true, code: 'KeyK' }); // Cyrillic layout
    expect(palette).toHaveBeenCalledTimes(1);

    press('?', { shiftKey: true });
    expect(help).toHaveBeenCalledTimes(1);

    press('g', {}, screen.getByTestId('in'));
    press('i', {}, screen.getByTestId('in'));
    expect(go).toHaveBeenCalledTimes(1); // not while typing
  });

  it('wrong modifiers do not match; disabled hotkeys do not fire', () => {
    const fn = jest.fn();
    function C({ enabled }: { enabled: boolean }) {
      useHotkey('ctrl+s', fn, { enabled });
      return null;
    }
    const { rerender } = render(<C enabled />);
    press('s');
    press('s', { ctrlKey: true, shiftKey: true });
    expect(fn).not.toHaveBeenCalled();
    rerender(<C enabled={false} />);
    press('s', { ctrlKey: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('parse and format', () => {
    expect(parseHotkey('ctrl+shift+p')).toEqual([{ key: 'p', ctrl: true, meta: false, alt: false, shift: true }]);
    expect(parseHotkey('mod++')[0].key).toBe('+');
    expect(formatHotkey('ctrl+shift+p')).toBe('Ctrl+Shift+P');
    expect(formatHotkey('g i')).toBe('G then I');
  });
});
