# use-keyboard-scope

[![npm](https://img.shields.io/npm/v/use-keyboard-scope.svg)](https://www.npmjs.com/package/use-keyboard-scope)
[![size](https://img.shields.io/bundlephobia/minzip/use-keyboard-scope)](https://bundlephobia.com/package/use-keyboard-scope)

**Keyboard shortcuts with scopes.** When a modal is open, `Escape` should close the modal — not also the page behind it, and `/` should not focus the page's search box. Wrap the modal in `<HotkeyScope>`: hotkeys inside it win, and the page's hotkeys are blocked until it closes.

```tsx
import { HotkeyScope, useHotkey } from 'use-keyboard-scope';

function Page() {
  const [open, setOpen] = useState(false);
  useHotkey('mod+k', () => setOpen(true), { description: 'Open command palette' });
  useHotkey('/', () => searchRef.current?.focus(), { description: 'Search' });

  return (
    <HotkeyScope name="palette" active={open}>
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </HotkeyScope>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  useHotkey('escape', onClose); // only fires while the palette is on top
  useHotkey('mod+enter', runSelected);
  return <input autoFocus />;
}
```

## Install

```bash
npm install use-keyboard-scope
```

## Features

- **Scopes stack**: the most recently opened scope is active; nested modals just work. Scopes can let globals through with `blockGlobal={false}`.
- **Syntax**: `mod+k` (⌘ on Mac, Ctrl on Windows/Linux), `ctrl+shift+p`, `alt+1`, `escape`, `?`, arrows, **sequences** like `g i` (GitHub style), several at once `['mod+s', 'ctrl+s']`.
- **Any keyboard layout**: falls back to the physical key, so `mod+k` works on Cyrillic, Arabic, Greek… layouts.
- **Form-friendly**: plain keys are ignored while typing in inputs; combos with Ctrl/⌘/Alt and `Escape` still work (override with `enableOnFormFields`).
- **Help dialog**: `useHotkeyList()` returns the active shortcuts with descriptions and labels (`⌘K` / `Ctrl+K`).
- One shared `keydown` listener, no matter how many hotkeys.

## API

| Export | Description |
| --- | --- |
| `useHotkey(keys, handler, options?)` | Options: `scope`, `enabled`, `preventDefault` (true), `stopPropagation`, `enableOnFormFields`, `description` |
| `<HotkeyScope name active? blockGlobal?>` | Scope component; hotkeys inside belong to it |
| `useHotkeyScope(name, { active, blockGlobal })` | Hook version |
| `useHotkeyList()` | `{ hotkey, label, description, scope }[]` currently active |
| `useActiveScope()` | Name of the top scope or `null` |
| `formatHotkey('mod+shift+p')` | `⌘⇧P` / `Ctrl+Shift+P` |
| `parseHotkey(text)` | Parsed chords |

### Shortcut help dialog

```tsx
function ShortcutHelp() {
  const hotkeys = useHotkeyList();
  return (
    <ul>
      {hotkeys.filter((h) => h.description).map((h) => (
        <li key={h.hotkey}><kbd>{h.label}</kbd> {h.description}</li>
      ))}
    </ul>
  );
}
```

## License

MIT
