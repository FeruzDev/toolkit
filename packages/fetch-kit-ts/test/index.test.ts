/** @jest-environment node */
import { createClient, HTTPError, TimeoutError, NetworkError } from '../src';

type Call = { url: string; init: RequestInit };

function mockFetch(responder: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return responder({ url, init }, calls.length);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('fetch-kit-ts', () => {
  it('builds URLs with baseURL and query, parses JSON', async () => {
    const m = mockFetch(() => json({ id: 1 }));
    const api = createClient({ baseURL: 'https://api.test/v1/', fetch: m.fetch, query: { lang: 'uz' } });
    const data = await api.get<{ id: number }>('/users', { query: { page: 2, tags: ['a', 'b'], skip: undefined } });
    expect(data.id).toBe(1);
    expect(m.calls[0].url).toBe('https://api.test/v1/users?lang=uz&page=2&tags=a&tags=b');
    expect(m.calls[0].init.method).toBe('GET');
  });

  it('sends plain objects as JSON and keeps FormData as is', async () => {
    const m = mockFetch(() => new Response(null, { status: 204 }));
    const api = createClient({ fetch: m.fetch });
    expect(await api.post('https://x.test/a', { name: 'Ali' })).toBeUndefined();
    expect(m.calls[0].init.body).toBe('{"name":"Ali"}');
    expect((m.calls[0].init.headers as Headers).get('content-type')).toBe('application/json');

    const fd = new FormData();
    fd.append('f', '1');
    await api.post('https://x.test/b', fd);
    expect(m.calls[1].init.body).toBe(fd);
    expect((m.calls[1].init.headers as Headers).has('content-type')).toBe(false);
  });

  it('returns text for text responses', async () => {
    const m = mockFetch(() => new Response('hello', { headers: { 'content-type': 'text/plain' } }));
    expect(await createClient({ fetch: m.fetch }).get('https://x.test')).toBe('hello');
  });

  it('throws HTTPError with parsed body and does not retry 4xx', async () => {
    const m = mockFetch(() => json({ message: 'Not found' }, 404));
    const api = createClient({ fetch: m.fetch, retry: { limit: 3, delay: () => 0 } });
    const err: any = await api.get('https://x.test/u').catch((e) => e as any);
    expect(err).toBeInstanceOf(HTTPError);
    expect(err.status).toBe(404);
    expect(err.data).toEqual({ message: 'Not found' });
    expect(m.calls).toHaveLength(1);
  });

  it('retries 5xx and network errors for GET, then succeeds', async () => {
    const m = mockFetch((_, n) => {
      if (n === 1) throw new TypeError('fetch failed');
      if (n === 2) return json({}, 503);
      return json({ ok: true });
    });
    const api = createClient({ fetch: m.fetch, retry: { limit: 2, delay: () => 0 } });
    expect(await api.get('https://x.test')).toEqual({ ok: true });
    expect(m.calls).toHaveLength(3);
  });

  it('does not retry POST by default and wraps network errors', async () => {
    const m = mockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const err: any = await createClient({ fetch: m.fetch, retry: { delay: () => 0 } }).post('https://x.test', {}).catch((e) => e as any);
    expect(err).toBeInstanceOf(NetworkError);
    expect(m.calls).toHaveLength(1);
  });

  it('respects Retry-After', async () => {
    const m = mockFetch((_, n) => (n === 1 ? json({}, 429, { 'retry-after': '0' }) : json('ok')));
    expect(await createClient({ fetch: m.fetch }).get('https://x.test')).toBe('ok');
  });

  it('times out', async () => {
    const m = mockFetch(
      ({ init }) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const err: any = await createClient({ fetch: m.fetch, timeout: 20, retry: false }).get('https://x.test').catch((e) => e as any);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.message).toContain('timed out after 20ms');
  });

  it('honours a user AbortSignal without wrapping', async () => {
    const m = mockFetch(
      ({ init }) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('x')))),
    );
    const ac = new AbortController();
    const p = createClient({ fetch: m.fetch }).get('https://x.test', { signal: ac.signal });
    ac.abort(new Error('cancelled by user'));
    await expect(p).rejects.toThrow('cancelled by user');
  });

  it('runs interceptors (auth, response, error) and use()/extend()', async () => {
    const m = mockFetch((call) => ((call.init.headers as Headers).get('authorization') ? json({ me: 1 }) : json({}, 401)));
    const api = createClient({ fetch: m.fetch, headers: { 'x-app': 'demo' } });
    const remove = api.use({ onRequest: ({ init }) => init.headers.set('authorization', 'Bearer t') });
    expect(await api.get('https://x.test/me')).toEqual({ me: 1 });
    remove();

    const onError = jest.fn(() => new Error('Please log in'));
    await expect(api.get('https://x.test/me', { onError })).rejects.toThrow('Please log in');

    const v2 = api.extend({ headers: { 'x-version': '2' } });
    await v2.get('https://x.test/me').catch(() => undefined);
    const h = m.calls[m.calls.length - 1].init.headers as Headers;
    expect([h.get('x-app'), h.get('x-version')]).toEqual(['demo', '2']);
  });
});
