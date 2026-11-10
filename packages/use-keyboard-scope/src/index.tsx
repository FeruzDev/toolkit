import React, { createContext, useContext, useEffect, useId, useRef, useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* parsing & matching                                                  */
/* ------------------------------------------------------------------ */

interface Chord {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

const ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  plus: '+',
  comma: ',',
  period: '.',
  slash: '/',
};

function parseChord(text: string): Chord {
  const parts = text.toLowerCase().split('+');
  // "mod++" → key "+"
  const key = parts[parts.length - 1] === '' ? '+' : parts[parts.length - 1];
  const mods = new Set(parts.slice(0, parts[parts.length - 1] === '' ? -2 : -1));
  const mac = isMac();
  return {
    key: ALIASES[key] ?? key,
    ctrl: mods.has('ctrl') || mods.has('control') || (mods.has('mod') && !mac),
    meta: mods.has('meta') || mods.has('cmd') || mods.has('command') || (mods.has('mod') && mac),
    alt: mods.has('alt') || mods.has('option'),
    shift: mods.has('shift'),
  };
}

/** Parses `'mod+k'`, `'shift+?'`, `'g i'` (sequence). */
export function parseHotkey(hotkey: string): Chord[] {
  return hotkey.trim().split(/\s+/).map(parseChord);
}

function eventKeys(e: KeyboardEvent): string[] {
  const keys = [e.key.toLowerCase()];
  // Non-Latin layouts (Cyrillic, Arabic…): fall back to the physical key, so mod+k works on "л".
  const code = e.code ?? '';
  if (/^Key[A-Z]$/.test(code)) keys.push(code.slice(3).toLowerCase());
  else if (/^Digit\d$/.test(code)) keys.push(code.slice(5));
  return keys;
}

function chordMatches(chord: Chord, e: KeyboardEvent): boolean {
  if (!eventKeys(e).includes(chord.key)) return false;
  if (chord.ctrl !== e.ctrlKey || chord.meta !== e.metaKey || chord.alt !== e.altKey) return false;
  // symbols like "?" already imply shift; only check shift for letters/named keys
  const symbol = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key);
  return symbol || chord.shift === e.shiftKey;
}

const isFormField = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

/** Human-readable label: `formatHotkey('mod+k')` → `⌘K` on Mac, `Ctrl+K` elsewhere. */
export function formatHotkey(hotkey: string): string {
  const mac = isMac();
  return parseHotkey(hotkey)
    .map((c) => {
      const parts: string[] = [];
      if (c.ctrl) parts.push(mac ? '⌃' : 'Ctrl');
      if (c.alt) parts.push(mac ? '⌥' : 'Alt');
      if (c.shift) parts.push(mac ? '⇧' : 'Shift');
      if (c.meta) parts.push(mac ? '⌘' : 'Win');
      const names: Record<string, string> = { ' ': 'Space', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', enter: '↵' };
      parts.push(names[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key[0].toUpperCase() + c.key.slice(1)));
      return parts.join(mac ? '' : '+');
    })
    .join(' then ');
}

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */

interface ScopeEntry {
  id: string;
  name: string;
  blockGlobal: boolean;
}

interface Registration {
  id: string;
  hotkey: string;
  sequence: Chord[];
  scope: string | null; // null = global
  handler: (e: KeyboardEvent) => void;
  options: HotkeyOptions;
  order: number;
}

export interface HotkeyInfo {
  hotkey: string;
  label: string;
  description?: string;
  scope: string | null;
}

const scopes: ScopeEntry[] = [];
const registrations = new Map<string, Registration>();
const listeners = new Set<() => void>();
let order = 0;
let progress: { reg: Registration; index: number; at: number }[] = [];
let installed = false;
let snapshot: HotkeyInfo[] = [];

const SEQUENCE_TIMEOUT = 1000;

function activeScope(): ScopeEntry | undefined {
  return scopes[scopes.length - 1];
}

function isActive(reg: Registration): boolean {
  const top = activeScope();
  if (reg.scope === null) return !top || !top.blockGlobal;
  return top?.name === reg.scope;
}

function emit() {
  snapshot = [...registrations.values()]
    .filter((r) => isActive(r) && r.options.enabled !== false)
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ hotkey: r.hotkey, label: formatHotkey(r.hotkey), description: r.options.description, scope: r.scope }));
  listeners.forEach((l) => l());
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented && e.isComposing) return;
  const now = Date.now();
  const candidates = [...registrations.values()].filter((r) => r.options.enabled !== false && isActive(r)).sort((a, b) => b.order - a.order);

  // continue sequences in progress
  progress = progress.filter((p) => now - p.at < SEQUENCE_TIMEOUT && registrations.has(p.reg.id) && isActive(p.reg));
  const advanced: typeof progress = [];
  let fired: Registration | undefined;

  for (const p of progress) {
    if (chordMatches(p.reg.sequence[p.index], e)) {
      if (p.index + 1 === p.reg.sequence.length) fired ??= p.reg;
      else advanced.push({ reg: p.reg, index: p.index + 1, at: now });
    }
  }

  for (const reg of candidates) {
    if (fired) break;
    const inField = isFormField(e.target);
    const first = reg.sequence[0];
    const allowInField = reg.options.enableOnFormFields ?? (first.ctrl || first.meta || first.alt || first.key === 'escape');
    if (inField && !allowInField) continue;
    if (!chordMatches(first, e)) continue;
    if (reg.sequence.length === 1) fired = reg;
    else advanced.push({ reg, index: 1, at: now });
  }

  progress = fired ? [] : advanced;
  if (fired) {
    if (fired.options.preventDefault !== false) e.preventDefault();
    if (fired.options.stopPropagation) e.stopPropagation();
    fired.handler(e);
  }
}

function install() {
  if (installed || typeof window === 'undefined') return;
  window.addEventListener('keydown', onKeyDown);
  installed = true;
}

function uninstallIfIdle() {
  if (installed && registrations.size === 0) {
    window.removeEventListener('keydown', onKeyDown);
    installed = false;
  }
}

/* ------------------------------------------------------------------ */
/* React API                                                           */
/* ------------------------------------------------------------------ */

const ScopeContext = createContext<string | null>(null);

export interface ScopeOptions {
  /** Activate the scope (e.g. `open` of a modal). @default true */
  active?: boolean;
  /** While this scope is on top, global hotkeys are disabled. @default true */
  blockGlobal?: boolean;
}

/**
 * Push a scope while mounted/active. The most recently activated scope is the active one.
 * Hotkeys registered *inside* it (or with `{ scope: name }`) only fire while it is on top.
 */
export function useHotkeyScope(name: string, options: ScopeOptions = {}): void {
  const id = useId();
  const { active = true, blockGlobal = true } = options;
  useEffect(() => {
    if (!active) return undefined;
    scopes.push({ id, name, blockGlobal });
    progress = [];
    emit();
    return () => {
      const i = scopes.findIndex((s) => s.id === id);
      if (i >= 0) scopes.splice(i, 1);
      progress = [];
      emit();
    };
  }, [id, name, active, blockGlobal]);
}

export interface HotkeyScopeProps extends ScopeOptions {
  name: string;
  children?: React.ReactNode;
}

/**
 * Wrap a modal / drawer / panel: hotkeys inside belong to it and block the page's hotkeys while it is open.
 *
 * @example
 * <HotkeyScope name="edit-dialog" active={open}>
 *   <Dialog />   // useHotkey('escape', close) inside only fires while the dialog is on top
 * </HotkeyScope>
 */
export function HotkeyScope({ name, children, ...options }: HotkeyScopeProps) {
  useHotkeyScope(name, options);
  return <ScopeContext.Provider value={name}>{children}</ScopeContext.Provider>;
}

export interface HotkeyOptions {
  /** Scope name; defaults to the nearest `<HotkeyScope>`, or global. Use `'global'` to force global. */
  scope?: string;
  /** @default true */
  enabled?: boolean;
  /** @default true */
  preventDefault?: boolean;
  stopPropagation?: boolean;
  /**
   * Fire while typing in inputs/textareas/contenteditable.
   * @default true for combos with ctrl/meta/alt and for Escape, false otherwise
   */
  enableOnFormFields?: boolean;
  /** Shown by `useHotkeyList()` (help dialogs, command palettes). */
  description?: string;
}

/**
 * Register a keyboard shortcut.
 *
 * Syntax: `'mod+k'` (⌘ on Mac, Ctrl elsewhere), `'ctrl+shift+p'`, `'escape'`, `'?'`, sequences `'g i'`.
 * Pass several: `['mod+s', 'ctrl+s']`.
 *
 * @example
 * useHotkey('mod+k', () => setPaletteOpen(true), { description: 'Open command palette' });
 * useHotkey('g i', () => navigate('/inbox'), { description: 'Go to inbox' });
 */
export function useHotkey(hotkey: string | string[], handler: (event: KeyboardEvent) => void, options: HotkeyOptions = {}): void {
  const contextScope = useContext(ScopeContext);
  const scope = options.scope === 'global' ? null : options.scope ?? contextScope;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const baseId = useId();
  const keys = (Array.isArray(hotkey) ? hotkey : [hotkey]).join('\u0000');

  useEffect(() => {
    const list = keys.split('\u0000');
    const ids = list.map((h, i) => {
      const id = `${baseId}:${i}`;
      registrations.set(id, {
        id,
        hotkey: h,
        sequence: parseHotkey(h),
        scope,
        handler: (e) => handlerRef.current(e),
        options: optionsRef.current,
        order: ++order,
      });
      return id;
    });
    install();
    emit();
    return () => {
      ids.forEach((id) => registrations.delete(id));
      emit();
      uninstallIfIdle();
    };
  }, [keys, scope, baseId, options.enabled, options.description]);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Hotkeys that are active right now (for "?" help dialogs). */
export function useHotkeyList(): HotkeyInfo[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Name of the active scope (`null` = global). */
export function useActiveScope(): string | null {
  return useSyncExternalStore(subscribe, () => activeScope()?.name ?? null, () => null);
}
