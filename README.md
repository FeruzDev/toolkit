# FeruzDev toolkit

Small, focused, zero-dependency TypeScript packages for everyday web development. Each package is published separately on npm — install only what you need.

| Package | What it does | Replaces |
| --- | --- | --- |
| [`use-live-announcer`](packages/use-live-announcer) | Announce alarms & changes to screen readers (aria-live) | hand-written live regions, react-aria-live |
| [`envguard`](packages/envguard) | `.env` loading + validation + types | dotenv + envalid / zod env |
| [`cx-variants`](packages/cx-variants) | `cn()` + variants + Tailwind merge | clsx + cva + tailwind-merge |
| [`fetch-kit-ts`](packages/fetch-kit-ts) | 2 KB fetch client with retry, timeout, interceptors | axios, ky |
| [`duration-i18n`](packages/duration-i18n) | Durations & "time ago" in 100+ languages, zero locale files | ms, humanize-duration, pretty-ms |
| [`tiny-uuidv7`](packages/tiny-uuidv7) | Monotonic, time-sortable UUIDv7 | uuid, ulid, nanoid |
| [`temporal-dates`](packages/temporal-dates) | date-fns-style helpers on the Temporal API | date-fns, dayjs, moment |
| [`use-stale-data`](packages/use-stale-data) | fresh / warning / stale status + live data age | manual timers |
| [`use-throttled-stream`](packages/use-throttled-stream) | Batch WebSocket/SSE messages into throttled renders | custom buffering |
| [`use-offline-actions`](packages/use-offline-actions) | Offline outbox: persist, retry, sync in order | hand-written queues, Workbox background sync |
| [`use-idle-redirect`](packages/use-idle-redirect) | Inactivity warning + auto logout, synced across tabs | react-idle-timer |
| [`use-visibility-polling`](packages/use-visibility-polling) | Polling that pauses in hidden tabs/offline, no overlap | setInterval + fetch |
| [`use-previous-diff`](packages/use-previous-diff) | usePrevious + deep diff of what changed | use-previous, deep-diff |
| [`use-typed-url-state`](packages/use-typed-url-state) | Typed state synced with URL query params | nuqs, use-query-params |
| [`use-keyboard-scope`](packages/use-keyboard-scope) | Scoped hotkeys (modals block page shortcuts), sequences | react-hotkeys-hook, mousetrap |
| [`react-virtual-log`](packages/react-virtual-log) | Log viewer for millions of lines: tail, search, ANSI | react-lazylog, xterm for read-only logs |
| [`react-column-resize`](packages/react-column-resize) | Resizable table columns + persistence, auto-fit | react-table plugins, custom drag code |
| [`react-state-views`](packages/react-state-views) | Loading/empty/error views + AsyncView (en/uz/ru) | hand-written if/else in every component |

Every package ships an `llms.txt` with a compact usage guide for AI coding assistants (`node_modules/<package>/llms.txt`), full JSDoc with examples, and TypeScript types.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Packages live in `packages/*`. A new package: `node scripts/new-package.mjs <name> "<description>" "<keywords>" [react] [tsx]`.

## Releasing

Bump the `version` in a package's `package.json` and push to `main`. CI tests everything and publishes every package whose version is not on npm yet (`scripts/publish-new.mjs`), using the `NPM_TOKEN` repository secret or npm Trusted Publishing, with provenance.

## License

MIT
