# envguard

[![npm](https://img.shields.io/npm/v/envguard.svg)](https://www.npmjs.com/package/envguard)
[![size](https://img.shields.io/bundlephobia/minzip/envguard)](https://bundlephobia.com/package/envguard)
[![license](https://img.shields.io/npm/l/envguard.svg)](./LICENSE)

**`.env` loading + validation + TypeScript types in one tiny package.** Replaces `dotenv` + `envalid` / `zod` env schemas. Zero dependencies.

```ts
import { createEnv, str, port, url, bool, oneOf } from 'envguard';

export const env = createEnv({
  NODE_ENV: oneOf(['development', 'production', 'test'], { default: 'development' }),
  PORT: port({ default: 3000 }),
  DATABASE_URL: url({ desc: 'Postgres connection string' }),
  JWT_SECRET: str({ secret: true }),
  DEBUG: bool({ default: false }),
});

env.PORT;     // number
env.NODE_ENV; // 'development' | 'production' | 'test'
```

If something is wrong, you get **every** problem at once, in plain words:

```
EnvError: Invalid environment variables (3):
  ✖ PORT          must be a port number (1-65535) (received: "abc")
  ✖ DATABASE_URL  missing — Postgres connection string (url)
  ✖ JWT_SECRET    missing (string)

Fix them in your .env file or the environment.
```

## Install

```bash
npm install envguard
```

## Why

| | envguard | dotenv | envalid | zod + dotenv | @t3-oss/env |
| --- | --- | --- | --- | --- | --- |
| Reads `.env` files | ✅ | ✅ | ❌ | needs dotenv | ❌ |
| Validation + type inference | ✅ | ❌ | ✅ | ✅ | ✅ |
| All errors at once, secrets masked | ✅ | – | ✅ | manual | ✅ |
| `.env.example` generator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dependencies | 0 | 0 | 1 | 2 | 2+ |

## Validators

| Validator | Type | Accepts |
| --- | --- | --- |
| `str()` | `string` | any non-empty string |
| `num()` / `int()` | `number` | `3.14` / `42` |
| `bool()` | `boolean` | `true/false`, `1/0`, `yes/no`, `on/off` |
| `port()` | `number` | 1–65535 |
| `url()` | `string` | absolute URL (`https://`, `postgres://`, `redis://`) |
| `email()` | `string` | e-mail |
| `list()` | `string[]` | `a, b, c` |
| `json<T>()` | `T` | JSON |
| `oneOf(['a', 'b'])` | `'a' \| 'b'` | one of the values |
| `makeValidator(kind, parse)` | custom | your rules |

Every validator takes the same options:

| Option | Description |
| --- | --- |
| `default` | Used when missing or empty |
| `optional: true` | Allow missing; type becomes `T \| undefined` |
| `desc` | Shown in errors and `.env.example` |
| `example` | Value for `.env.example` |
| `secret: true` | Never print the value in errors |

## Options

```ts
createEnv(schema, {
  path: ['.env.local', '.env'], // default; earlier files win, real env vars win over files. `false` = don't read files
  env: process.env,             // or import.meta.env (Vite) — files are not read when you pass env
  populateProcessEnv: true,     // copy file values into process.env, like dotenv
  onError: 'throw',             // or 'exit': print the message and process.exit(1)
});
```

### `.env` syntax supported

```bash
# comments
export PORT=3000
NAME="My App"            # inline comments
RAW='no ${expansion} here'
MULTILINE="line 1
line 2"
ESCAPES="a\nb"
URL=http://${HOST:-localhost}:${PORT}
```

### Generate `.env.example`

```ts
import { writeFileSync } from 'node:fs';
import { envExample } from 'envguard';

writeFileSync('.env.example', envExample(schema));
```

### Vite / browser

```ts
export const env = createEnv({ VITE_API_URL: url() }, { env: import.meta.env });
```

### Custom validator

```ts
import { makeValidator } from 'envguard';

const hexColor = makeValidator('hex color', (raw) => {
  if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error('must look like #ff0000');
  return raw;
});
```

## License

MIT
