# fetch-kit-ts

[![npm](https://img.shields.io/npm/v/fetch-kit-ts.svg)](https://www.npmjs.com/package/fetch-kit-ts)
[![size](https://img.shields.io/bundlephobia/minzip/fetch-kit-ts)](https://bundlephobia.com/package/fetch-kit-ts)
[![license](https://img.shields.io/npm/l/fetch-kit-ts.svg)](./LICENSE)

**A ~2 KB typed `fetch` wrapper — the parts of axios you actually use.**
Base URL, automatic JSON, query params, timeout, retry with backoff, interceptors and typed errors. Zero dependencies. Browser, Node 18+, Bun, Deno, Cloudflare Workers.

```ts
import { createClient } from 'fetch-kit-ts';

export const api = createClient({
  baseURL: 'https://api.example.com',
  timeout: 8000,
  retry: 2,
});

const user = await api.get<User>('/users/1');
const created = await api.post<User>('/users', { name: 'Ali' }); // sent as JSON
const list = await api.get<User[]>('/users', { query: { page: 2, role: ['admin', 'editor'] } });
```

## Install

```bash
npm install fetch-kit-ts
```

## Features

| | fetch-kit-ts | axios | ky | native fetch |
| --- | --- | --- | --- | --- |
| Size (min+gz) | ~2 KB | ~14 KB | ~4 KB | 0 |
| Returns parsed data | ✅ | `res.data` | `.json()` | `.json()` |
| Throws on 4xx/5xx with parsed body | ✅ | ✅ | ✅ | ❌ |
| Timeout | ✅ | ✅ | ✅ | manual |
| Retry + backoff + `Retry-After` | ✅ | plugin | ✅ | ❌ |
| Interceptors | ✅ | ✅ | hooks | ❌ |
| Built on fetch (edge/workers) | ✅ | adapter | ✅ | ✅ |

## Auth token interceptor

```ts
api.use({
  onRequest: ({ init }) => {
    const token = localStorage.getItem('token');
    if (token) init.headers.set('Authorization', `Bearer ${token}`);
  },
  onError: (error) => {
    if (error instanceof HTTPError && error.status === 401) location.href = '/login';
  },
});
```

`use()` returns a function that removes the interceptors.

## Errors

```ts
import { HTTPError, TimeoutError, NetworkError } from 'fetch-kit-ts';

try {
  await api.post('/orders', order);
} catch (error) {
  if (error instanceof HTTPError) {
    console.log(error.status, error.data); // data = parsed JSON/text error body
  } else if (error instanceof TimeoutError) {
    // took longer than `timeout`
  } else if (error instanceof NetworkError) {
    // offline, DNS, CORS…
  }
}
```

All three extend `FetchError`. Aborting with your own `signal` rejects with your abort reason.

## Options

Client options (also accepted per request):

| Option | Default | Description |
| --- | --- | --- |
| `baseURL` | – | Prefix for relative URLs (client only) |
| `headers` | – | Default headers |
| `query` | – | Query params; arrays repeat the key, `null`/`undefined` skipped |
| `timeout` | `10000` | Per attempt, ms. `0` = no timeout |
| `retry` | `{ limit: 2 }` | Number, `false`, or `{ limit, methods, statusCodes, delay(attempt) }`. Retries GET/HEAD/PUT/DELETE/OPTIONS on network errors, timeouts and 408/429/500/502/503/504 |
| `responseType` | `'auto'` | `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData' \| 'response'` |
| `throwHttpErrors` | `true` | `false` returns the body of error responses instead |
| `onRequest` / `onResponse` / `onError` | – | Interceptors |
| `fetch` | `globalThis.fetch` | Custom implementation (client only) |
| `init` | – | Extra `RequestInit` (`credentials`, `cache`, …) |

Per request only: `method`, `body` (plain objects → JSON), `json`, `signal`.

## Methods

`api(url, options)`, `api.get`, `api.delete`, `api.head` (returns `Response`), `api.post(url, body, options)`, `api.put`, `api.patch`, `api.use(interceptors)`, `api.extend(options)`.

A default client is exported as `http`:

```ts
import { http } from 'fetch-kit-ts';
const todos = await http.get<Todo[]>('https://jsonplaceholder.typicode.com/todos');
```

## Migrating from axios

| axios | fetch-kit-ts |
| --- | --- |
| `axios.create({ baseURL })` | `createClient({ baseURL })` |
| `const { data } = await axios.get(url)` | `const data = await api.get(url)` |
| `params: {...}` | `query: {...}` |
| `axios.interceptors.request.use(fn)` | `api.use({ onRequest })` |
| `error.response.status` / `.data` | `error.status` / `error.data` |

## License

MIT
