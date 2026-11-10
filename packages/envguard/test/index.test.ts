import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEnv, parseDotenv, str, num, int, bool, port, url, email, list, json, oneOf, makeValidator, envExample, EnvError } from '../src';

describe('parseDotenv', () => {
  it('parses common syntax', () => {
    const src = [
      '# comment',
      'export PORT=3000',
      'NAME="My App" # trailing',
      "RAW='a $NOT ${EXPANDED}'",
      'INLINE=value # comment',
      'EMPTY=',
      'MULTI="line1\nline2"',
      'REAL_MULTI="a',
      'b"',
      'URL=${HOST:-localhost}:${PORT}',
      'ESCAPED=\\${PORT}',
      '  SPACED = x  ',
    ].join('\r\n');
    expect(parseDotenv(src)).toEqual({
      PORT: '3000',
      NAME: 'My App',
      RAW: 'a $NOT ${EXPANDED}',
      INLINE: 'value',
      EMPTY: '',
      MULTI: 'line1\nline2',
      REAL_MULTI: 'a\nb',
      URL: 'localhost:3000',
      ESCAPED: '${PORT}',
      SPACED: 'x',
    });
  });
});

describe('createEnv', () => {
  const schema = {
    NODE_ENV: oneOf(['development', 'production', 'test'], { default: 'development' }),
    PORT: port({ default: 3000 }),
    DATABASE_URL: url({ desc: 'Postgres connection string' }),
    SECRET: str({ secret: true }),
    DEBUG: bool({ default: false }),
    RATIO: num({ optional: true }),
    WORKERS: int({ default: 2 }),
    ADMIN: email({ optional: true }),
    ORIGINS: list({ default: [] }),
    FLAGS: json<{ beta: boolean }>({ default: { beta: false } }),
  };

  it('returns typed, converted values', () => {
    const env = createEnv(schema, {
      path: false,
      env: { DATABASE_URL: 'postgres://u:p@db/app', SECRET: 's3cr3t', DEBUG: 'yes', PORT: '8080', ORIGINS: 'a.com, b.com,', FLAGS: '{"beta":true}' },
    });
    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 8080,
      DATABASE_URL: 'postgres://u:p@db/app',
      SECRET: 's3cr3t',
      DEBUG: true,
      RATIO: undefined,
      WORKERS: 2,
      ADMIN: undefined,
      ORIGINS: ['a.com', 'b.com'],
      FLAGS: { beta: true },
    });
    // type checks
    const p: number = env.PORT;
    const mode: 'development' | 'production' | 'test' = env.NODE_ENV;
    const ratio: number | undefined = env.RATIO;
    expect([p, mode, ratio]).toBeTruthy();
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('reports every problem at once and hides secrets', () => {
    let error: EnvError | undefined;
    try {
      createEnv(schema, { path: false, env: { PORT: 'abc', SECRET: '', DATABASE_URL: 'not a url', NODE_ENV: 'prod' } });
    } catch (e) {
      error = e as EnvError;
    }
    expect(error).toBeInstanceOf(EnvError);
    expect(error!.issues.map((i) => i.key)).toEqual(['NODE_ENV', 'PORT', 'DATABASE_URL', 'SECRET']);
    expect(error!.message).toContain('must be one of: development, production, test (received: "prod")');
    expect(error!.message).toContain('PORT          must be a port number (1-65535) (received: "abc")');
    expect(error!.message).toContain('SECRET        missing (string)');
  });

  it('masks secret values', () => {
    const s = { KEY: makeValidator('hex', () => { throw new Error('bad'); })({ secret: true }) };
    expect(() => createEnv(s, { path: false, env: { KEY: 'sk-live-123' } })).toThrow('(received: ***)');
  });

  it('loads .env files: env > first file > later files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-'));
    fs.writeFileSync(path.join(dir, '.env'), 'A=from-env\nB=from-env\nC=from-env\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'B=from-local\nC=from-local\n');
    const env = createEnv(
      { A: str(), B: str(), C: str() },
      { path: [path.join(dir, '.env.local'), path.join(dir, '.env')], env: { C: 'from-process' } },
    );
    expect(env).toEqual({ A: 'from-env', B: 'from-local', C: 'from-process' });
  });

  it('envExample', () => {
    expect(envExample({ PORT: port({ default: 3000 }), DB: url({ desc: 'Database', example: 'postgres://localhost/app' }) })).toBe(
      '# port, default: 3000\nPORT=3000\n\n# Database — url, required\nDB=postgres://localhost/app\n',
    );
  });
});
