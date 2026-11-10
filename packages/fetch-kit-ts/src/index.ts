export type QueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>;
export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'response' | 'auto';

export interface RetryOptions {
  /** Max retries (not counting the first attempt). @default 2 */
  limit?: number;
  /** Methods that are retried. @default ['GET','HEAD','PUT','DELETE','OPTIONS'] */
  methods?: string[];
  /** HTTP statuses that are retried. @default [408, 429, 500, 502, 503, 504] */
  statusCodes?: number[];
  /** Delay before retry `attempt` (1-based) in ms. @default exponential 300ms·2ⁿ with jitter, max 10s */
  delay?: (attempt: number) => number;
}

export interface RequestContext {
  url: string;
  init: RequestInit & { headers: Headers };
  options: RequestOptions;
  /** 0 for the first attempt, then 1, 2… */
  attempt: number;
}

export interface Interceptors {
  /** Runs before every request (and retry). Mutate `ctx.init.headers`, or return a new context. */
  onRequest?: (ctx: RequestContext) => void | RequestContext | Promise<void | RequestContext>;
  /** Runs after every response (also non-2xx). Return a different Response to replace it. */
  onResponse?: (response: Response, ctx: RequestContext) => void | Response | Promise<void | Response>;
  /** Runs when a request finally fails. Return/throw another error to replace it. */
  onError?: (error: FetchError, ctx: RequestContext) => void | Error | Promise<void | Error>;
}

export interface ClientOptions extends Interceptors {
  /** Prefix for relative URLs. */
  baseURL?: string;
  /** Default headers. */
  headers?: HeadersInit;
  /** Timeout per attempt in ms. `0` disables. @default 10000 */
  timeout?: number;
  /** Retry settings, a retry count, or `false`. @default { limit: 2 } */
  retry?: RetryOptions | number | false;
  /** Default query parameters. */
  query?: Record<string, QueryValue>;
  /** How to read the body. `auto` = by content-type. @default 'auto' */
  responseType?: ResponseType;
  /** Throw `HTTPError` for non-2xx responses. @default true */
  throwHttpErrors?: boolean;
  /** Custom fetch implementation. @default globalThis.fetch */
  fetch?: typeof fetch;
  /** Extra RequestInit fields (credentials, cache, mode…). */
  init?: Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'>;
}

export interface RequestOptions extends Omit<ClientOptions, 'baseURL' | 'fetch'> {
  method?: string;
  /** Request body. Plain objects/arrays are sent as JSON automatically. */
  body?: unknown;
  /** Same as `body` but always JSON. */
  json?: unknown;
  signal?: AbortSignal;
}

/** Base class of all errors thrown by the client. */
export class FetchError extends Error {
  constructor(
    message: string,
    readonly request: { url: string; method: string },
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'FetchError';
  }
}

/** Non-2xx response. `data` holds the parsed error body (JSON or text). */
export class HTTPError<T = unknown> extends FetchError {
  constructor(
    readonly response: Response,
    readonly data: T,
    request: { url: string; method: string },
  ) {
    super(`${request.method} ${request.url} failed with ${response.status} ${response.statusText}`.trim(), request);
    this.name = 'HTTPError';
  }
  get status(): number {
    return this.response.status;
  }
}

/** The request took longer than `timeout`. */
export class TimeoutError extends FetchError {
  constructor(request: { url: string; method: string }, timeout: number) {
    super(`${request.method} ${request.url} timed out after ${timeout}ms`, request);
    this.name = 'TimeoutError';
  }
}

/** Network failure (offline, DNS, CORS…). */
export class NetworkError extends FetchError {
  constructor(request: { url: string; method: string }, cause: unknown) {
    super(`${request.method} ${request.url} failed: ${(cause as Error)?.message ?? 'network error'}`, request, { cause });
    this.name = 'NetworkError';
  }
}

const RETRY_METHODS = ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'];
const RETRY_STATUS = [408, 429, 500, 502, 503, 504];
const defaultDelay = (attempt: number) => Math.min(10000, 300 * 2 ** (attempt - 1)) * (0.8 + Math.random() * 0.4);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    }, { once: true });
  });

function buildURL(input: string, baseURL: string | undefined, query: Record<string, QueryValue> | undefined): string {
  let url = input;
  if (baseURL && !/^[a-z][a-z\d+.-]*:/i.test(input)) {
    url = baseURL.replace(/\/+$/, '') + '/' + input.replace(/^\/+/, '');
  }
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
      else params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

const isPlainBody = (b: unknown) =>
  b !== null &&
  typeof b === 'object' &&
  !(b instanceof FormData) &&
  !(b instanceof URLSearchParams) &&
  !(b instanceof Blob) &&
  !(b instanceof ArrayBuffer) &&
  !ArrayBuffer.isView(b) &&
  !(typeof ReadableStream !== 'undefined' && b instanceof ReadableStream);

async function readBody(response: Response, type: ResponseType): Promise<unknown> {
  if (type === 'response') return response;
  if (response.status === 204 || response.status === 205 || response.headers.get('content-length') === '0') return undefined;
  if (type === 'auto') {
    const ct = response.headers.get('content-type') ?? '';
    if (/[/+]json\b/i.test(ct)) {
      const text = await response.text();
      return text ? JSON.parse(text) : undefined;
    }
    if (/^text\/|xml/i.test(ct) || !ct) return response.text();
    return response.blob();
  }
  return response[type]();
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

const mergeHeaders = (...sources: Array<HeadersInit | undefined>) => {
  const headers = new Headers();
  for (const src of sources) if (src) new Headers(src).forEach((v, k) => headers.set(k, v));
  return headers;
};

export interface Client {
  <T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  get<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  head(url: string, options?: RequestOptions): Promise<Response>;
  post<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  /** Add interceptors after creation (e.g. auth). Returns a function that removes them. */
  use(interceptors: Interceptors): () => void;
  /** New client with merged options (headers and query are merged). */
  extend(options: ClientOptions): Client;
  readonly options: ClientOptions;
}

/**
 * Create a configured HTTP client.
 *
 * @example
 * const api = createClient({
 *   baseURL: 'https://api.example.com',
 *   headers: { Accept: 'application/json' },
 *   timeout: 8000,
 *   retry: 2,
 * });
 * api.use({ onRequest: ({ init }) => init.headers.set('Authorization', `Bearer ${getToken()}`) });
 *
 * const user = await api.get<User>('/users/1');
 * const created = await api.post<User>('/users', { name: 'Ali' });
 */
export function createClient(clientOptions: ClientOptions = {}): Client {
  const extra: Interceptors[] = [];

  async function request<T>(input: string, options: RequestOptions = {}): Promise<T> {
    const o = { ...clientOptions, ...options };
    const method = (options.method ?? 'GET').toUpperCase();
    const url = buildURL(input, clientOptions.baseURL, { ...clientOptions.query, ...options.query });
    const req = { url, method };
    const interceptors: Interceptors[] = [clientOptions, ...extra, options];

    const retry: RetryOptions =
      o.retry === false ? { limit: 0 } : typeof o.retry === 'number' ? { limit: o.retry } : { limit: 2, ...o.retry };
    const limit = (retry.methods ?? RETRY_METHODS).includes(method) ? retry.limit ?? 2 : 0;
    const timeout = o.timeout ?? 10000;
    const doFetch = clientOptions.fetch ?? globalThis.fetch;

    let body: BodyInit | undefined;
    const headers = mergeHeaders(clientOptions.headers, options.headers);
    const rawBody = options.json !== undefined ? options.json : options.body;
    if (rawBody !== undefined) {
      if (options.json !== undefined || isPlainBody(rawBody)) {
        body = JSON.stringify(rawBody);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      } else {
        body = rawBody as BodyInit;
      }
    }
    if (!headers.has('accept')) headers.set('accept', 'application/json, text/plain, */*');

    for (let attempt = 0; ; attempt++) {
      let ctx: RequestContext = {
        url,
        attempt,
        options,
        init: { ...clientOptions.init, ...options.init, method, headers: new Headers(headers), body },
      };

      const controller = new AbortController();
      const onAbort = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) throw options.signal.reason;
      options.signal?.addEventListener('abort', onAbort, { once: true });
      let timedOut = false;
      const timer = timeout > 0 ? setTimeout(() => ((timedOut = true), controller.abort()), timeout) : undefined;

      let error: FetchError | undefined;
      let response: Response | undefined;
      try {
        for (const i of interceptors) if (i.onRequest) ctx = (await i.onRequest(ctx)) ?? ctx;
        ctx.init.signal = controller.signal;
        response = await doFetch(ctx.url, ctx.init);
        for (const i of interceptors) if (i.onResponse) response = (await i.onResponse(response, ctx)) ?? response;
      } catch (err) {
        if (options.signal?.aborted) throw options.signal.reason ?? err;
        error = timedOut ? new TimeoutError(req, timeout) : err instanceof FetchError ? err : new NetworkError(req, err);
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      }

      if (response && !response.ok && o.throwHttpErrors !== false) {
        let data: unknown;
        try {
          data = await readBody(response.clone(), 'auto');
        } catch {
          data = undefined;
        }
        error = new HTTPError(response, data, req);
      }

      if (error) {
        const retriable = error instanceof HTTPError ? (retry.statusCodes ?? RETRY_STATUS).includes(error.status) : true;
        if (attempt < limit && retriable) {
          const wait = (error instanceof HTTPError && retryAfterMs(error.response)) || (retry.delay ?? defaultDelay)(attempt + 1);
          await sleep(wait, options.signal);
          continue;
        }
        let final: Error = error;
        for (const i of interceptors) if (i.onError) final = ((await i.onError(error, ctx)) as Error | undefined) ?? final;
        throw final;
      }

      return (await readBody(response!, o.responseType ?? 'auto')) as T;
    }
  }

  const client = (<T>(url: string, options?: RequestOptions) => request<T>(url, options)) as Client;
  client.get = (url, options) => request(url, { ...options, method: 'GET' });
  client.delete = (url, options) => request(url, { ...options, method: 'DELETE' });
  client.head = (url, options) => request<Response>(url, { ...options, method: 'HEAD', responseType: 'response' });
  client.post = (url, body, options) => request(url, { ...options, method: 'POST', body });
  client.put = (url, body, options) => request(url, { ...options, method: 'PUT', body });
  client.patch = (url, body, options) => request(url, { ...options, method: 'PATCH', body });
  client.use = (interceptors) => {
    extra.push(interceptors);
    return () => {
      const i = extra.indexOf(interceptors);
      if (i >= 0) extra.splice(i, 1);
    };
  };
  client.extend = (options) =>
    createClient({
      ...clientOptions,
      ...options,
      headers: mergeHeaders(clientOptions.headers, options.headers),
      query: { ...clientOptions.query, ...options.query },
    });
  (client as { options: ClientOptions }).options = clientOptions;
  return client;
}

/**
 * Ready-to-use client with default settings.
 *
 * @example
 * import { http } from 'fetch-kit-ts';
 * const todos = await http.get<Todo[]>('https://jsonplaceholder.typicode.com/todos', { query: { _limit: 5 } });
 */
export const http = createClient();
