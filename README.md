# FeruzDev toolkit

Small, focused, zero-dependency TypeScript packages for everyday web development. Each package is published separately on npm — install only what you need.

| Package | What it does | Replaces |
| --- | --- | --- |
| [`use-live-announcer`](packages/use-live-announcer) | Announce alarms & changes to screen readers (aria-live) | hand-written live regions, react-aria-live |
| [`envguard`](packages/envguard) | `.env` loading + validation + types | dotenv + envalid / zod env |
| [`cx-variants`](packages/cx-variants) | `cn()` + variants + Tailwind merge | clsx + cva + tailwind-merge |
| [`fetch-kit-ts`](packages/fetch-kit-ts) | 2 KB fetch client with retry, timeout, interceptors | axios, ky |

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
