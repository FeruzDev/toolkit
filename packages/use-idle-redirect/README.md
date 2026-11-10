# use-idle-redirect

[![npm](https://img.shields.io/npm/v/use-idle-redirect.svg)](https://www.npmjs.com/package/use-idle-redirect)
[![size](https://img.shields.io/bundlephobia/minzip/use-idle-redirect)](https://bundlephobia.com/package/use-idle-redirect)

**Bank-style auto logout for React.** Warn the user before their session expires with a live countdown, then log out and redirect — synced across all open tabs.

```tsx
import { useIdleRedirect } from 'use-idle-redirect';

export function SessionGuard() {
  const { isWarning, remaining, reset } = useIdleRedirect({
    timeout: 15 * 60_000,      // 15 minutes of inactivity
    warningBefore: 60_000,     // warn during the last minute
    onIdle: () => fetch('/api/logout', { method: 'POST' }),
    redirectTo: '/login',      // → /login?reason=idle&returnTo=/current/page
  });

  if (!isWarning) return null;
  return (
    <div role="alertdialog" aria-live="assertive">
      You will be signed out in {Math.ceil(remaining / 1000)} seconds.
      <button onClick={reset}>Stay signed in</button>
    </div>
  );
}
```

Put `<SessionGuard />` once in your authenticated layout.

## Install

```bash
npm install use-idle-redirect
```

## Features

- **Warning stage** with a live `remaining` countdown (updates every second only while warning).
- **Cross-tab**: activity in any tab keeps all tabs signed in (`BroadcastChannel` + `localStorage` fallback).
- **Correct in background tabs**: status is computed from timestamps, so throttled timers don't cause late or early logouts.
- **Throttled listeners** (`mousemove`, `keydown`, `scroll`, `touchstart`, …) — negligible overhead.
- Once idle, stray mouse moves don't "wake" the session; only `reset()` does.
- SSR-safe.

## API

### `useIdleRedirect(options)`

All `useIdleTimer` options plus:

| Option | Default | Description |
| --- | --- | --- |
| `redirectTo` | `'/login'` | Target URL |
| `withReturnTo` | `true` | Adds `?reason=idle&returnTo=<path>` |
| `onIdle` | – | Async logout logic, awaited before redirect |
| `navigate` | `location.assign` | Custom navigation, e.g. React Router `navigate` or Next `router.replace` |

### `useIdleTimer(options)` — just the timer

| Option | Default | Description |
| --- | --- | --- |
| `timeout` | `900000` (15 min) | Inactivity until idle |
| `warningBefore` | `60000` | Warning stage length (`0` = none) |
| `onWarn(remaining)`, `onIdle()`, `onActive()` | – | Transition callbacks |
| `events` | mouse/keyboard/touch/scroll | Activity events |
| `crossTab` | `true` | Sync between tabs |
| `storageKey` | `'idle-timer'` | Sync channel name |
| `throttle` | `500` | Listener throttle, ms |
| `enabled` | `true` | Disable (e.g. on public pages) |

Returns `{ status: 'active' | 'warning' | 'idle', isIdle, isWarning, remaining, lastActive, reset(), pause(), resume() }`.

### Next.js / React Router

```tsx
const router = useRouter(); // next/navigation
useIdleRedirect({ timeout: 10 * 60_000, navigate: (url) => router.replace(url), onIdle: signOut });
```

## License

MIT
