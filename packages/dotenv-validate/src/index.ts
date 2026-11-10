/* ------------------------------------------------------------------ */
/* .env parser                                                         */
/* ------------------------------------------------------------------ */

/**
 * Parses the contents of a `.env` file.
 * Supports `export KEY=`, comments, single/double/backtick quotes, multiline double-quoted values,
 * `\n` escapes in double quotes and `${VAR}` expansion.
 *
 * @example
 * parseDotenv('PORT=3000\nNAME="My App" # comment') // { PORT: '3000', NAME: 'My App' }
 */
export function parseDotenv(source: string, vars: Record<string, string | undefined> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  const text = source.replace(/\r\n?/g, '\n');
  // KEY = "quoted" # comment   |   KEY = unquoted # comment
  const re = /^[ \t]*(?:export[ \t]+)?([\w.-]+)[ \t]*=[ \t]*(?:("(?:\\.|[^"\\])*"|'[^']*'|`[^`]*`)[ \t]*(?:#[^\n]*)?|([^\n]*))$/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    const key = match[1];
    let value = match[2] ?? match[3] ?? '';
    const quote = value[0];

    if (quote === '"' && value.endsWith('"') && value.length > 1) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      value = expand(value, out, vars);
    } else if ((quote === "'" || quote === '`') && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
      value = expand(value, out, vars);
    }
    out[key] = value;
  }
  return out;
}

function expand(value: string, local: Record<string, string>, vars: Record<string, string | undefined>): string {
  return value.replace(/\\?\$\{([\w.-]+)(?::-([^}]*))?\}/g, (whole, name: string, fallback?: string) => {
    if (whole.startsWith('\\')) return whole.slice(1);
    return vars[name] ?? local[name] ?? fallback ?? '';
  });
}

/* ------------------------------------------------------------------ */
/* Validators                                                          */
/* ------------------------------------------------------------------ */

export interface SpecOptions<T> {
  /** Value used when the variable is missing or empty. */
  default?: T;
  /** Allow the variable to be missing (type becomes `T | undefined`). */
  optional?: boolean;
  /** Shown in error messages and in `.env.example`. */
  desc?: string;
  /** Example value for `.env.example`. */
  example?: string;
  /** Hide the received value in error messages (API keys, passwords). */
  secret?: boolean;
}

export interface Spec<T> extends SpecOptions<T> {
  /** Converts the raw string or throws an Error with a human-readable reason. */
  parse: (raw: string) => T;
  /** Type name shown in `.env.example`. */
  kind: string;
}

export interface Validator<T> {
  (options: SpecOptions<T> & { optional: true; default?: undefined }): Spec<T | undefined>;
  (options?: SpecOptions<T>): Spec<T>;
}

/**
 * Create your own validator.
 *
 * @example
 * const hexColor = makeValidator('hex color', (raw) => {
 *   if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error('must look like #ff0000');
 *   return raw;
 * });
 */
export function makeValidator<T>(kind: string, parse: (raw: string) => T): Validator<T> {
  return ((options: SpecOptions<T> = {}) => ({ ...options, parse, kind })) as Validator<T>;
}

/** Any string (empty strings count as missing). */
export const str = makeValidator<string>('string', (raw) => raw);

/** A finite number (`3.14`, `-2`, `1e3`). */
export const num = makeValidator<number>('number', (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error('must be a number');
  return n;
});

/** An integer. */
export const int = makeValidator<number>('integer', (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error('must be an integer');
  return n;
});

const TRUE = ['true', '1', 'yes', 'on', 'y'];
const FALSE = ['false', '0', 'no', 'off', 'n'];
/** `true/false`, `1/0`, `yes/no`, `on/off`. */
export const bool = makeValidator<boolean>('boolean', (raw) => {
  const v = raw.toLowerCase();
  if (TRUE.includes(v)) return true;
  if (FALSE.includes(v)) return false;
  throw new Error('must be true/false, 1/0, yes/no or on/off');
});

/** A TCP port (1–65535). */
export const port = makeValidator<number>('port', (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('must be a port number (1-65535)');
  return n;
});

/** An absolute URL (`https://…`, `postgres://…`, `redis://…`). */
export const url = makeValidator<string>('url', (raw) => {
  try {
    new URL(raw);
  } catch {
    throw new Error('must be an absolute URL, e.g. https://example.com');
  }
  return raw;
});

/** An e-mail address. */
export const email = makeValidator<string>('email', (raw) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new Error('must be an e-mail address');
  return raw;
});

/** A comma-separated list → `string[]` (items trimmed, empties removed). */
export const list = makeValidator<string[]>('comma-separated list', (raw) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/** JSON value. Pass the expected type: `json<{ a: number }>()`. */
export function json<T = unknown>(options?: SpecOptions<T>): Spec<T> {
  return makeValidator<T>('JSON', (raw) => {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error('must be valid JSON');
    }
  })(options);
}

/**
 * One of the given values, typed as a union.
 *
 * @example
 * NODE_ENV: oneOf(['development', 'production', 'test'], { default: 'development' })
 */
export function oneOf<const V extends readonly string[]>(
  values: V,
  options: SpecOptions<V[number]> & { optional: true; default?: undefined },
): Spec<V[number] | undefined>;
export function oneOf<const V extends readonly string[]>(values: V, options?: SpecOptions<V[number]>): Spec<V[number]>;
export function oneOf<const V extends readonly string[]>(values: V, options: SpecOptions<V[number]> = {}): Spec<V[number]> {
  return {
    ...options,
    kind: values.join(' | '),
    parse: (raw) => {
      if (!values.includes(raw)) throw new Error(`must be one of: ${values.join(', ')}`);
      return raw as V[number];
    },
  };
}

/* ------------------------------------------------------------------ */
/* createEnv                                                           */
/* ------------------------------------------------------------------ */

export type Schema = Record<string, Spec<unknown>>;
export type InferEnv<S extends Schema> = { readonly [K in keyof S]: S[K] extends Spec<infer T> ? T : never };

export interface EnvIssue {
  key: string;
  message: string;
  received?: string;
}

/** Thrown when variables are missing or invalid. `issues` lists every problem. */
export class EnvError extends Error {
  constructor(readonly issues: EnvIssue[]) {
    super(formatIssues(issues));
    this.name = 'EnvError';
  }
}

function formatIssues(issues: EnvIssue[]): string {
  const width = Math.max(...issues.map((i) => i.key.length));
  const lines = issues.map((i) => {
    const received = i.received === undefined ? '' : ` (received: ${i.received})`;
    return `  ✖ ${i.key.padEnd(width)}  ${i.message}${received}`;
  });
  return `Invalid environment variables (${issues.length}):\n${lines.join('\n')}\n\nFix them in your .env file or the environment.`;
}

export interface CreateEnvOptions {
  /**
   * `.env` files to load (Node only). Earlier files win; real environment variables win over all files.
   * @default ['.env.local', '.env']
   */
  path?: string | string[] | false;
  /** Source of variables. @default process.env */
  env?: Record<string, string | undefined>;
  /** Also copy loaded file values into `process.env` (like dotenv). @default true */
  populateProcessEnv?: boolean;
  /** What to do on invalid env: throw `EnvError` or print and `process.exit(1)`. @default 'throw' */
  onError?: 'throw' | 'exit';
}

type FsLike = { existsSync(p: string): boolean; readFileSync(p: string, enc: 'utf8'): string };

function getFs(): FsLike | undefined {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  try {
    const fs = proc?.getBuiltinModule?.('node:fs') as FsLike | undefined;
    if (fs) return fs;
  } catch {
    /* not Node */
  }
  try {
    // CommonJS / older Node
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return typeof require === 'function' ? (require('fs') as FsLike) : undefined;
  } catch {
    return undefined;
  }
}

/** Reads and merges `.env` files (first file wins). Returns `{}` outside Node. */
export function loadDotenvFiles(paths: string[], vars: Record<string, string | undefined> = {}): Record<string, string> {
  const fs = getFs();
  if (!fs) return {};
  const merged: Record<string, string> = {};
  for (const file of [...paths].reverse()) {
    if (!fs.existsSync(file)) continue;
    Object.assign(merged, parseDotenv(fs.readFileSync(file, 'utf8'), vars));
  }
  return merged;
}

/**
 * Load `.env` files, validate variables against a schema and return a typed, frozen object.
 * Reports **all** problems at once.
 *
 * @example
 * import { createEnv, str, port, url, bool, oneOf } from 'dotenv-validate';
 *
 * export const env = createEnv({
 *   NODE_ENV: oneOf(['development', 'production', 'test'], { default: 'development' }),
 *   PORT: port({ default: 3000 }),
 *   DATABASE_URL: url({ desc: 'Postgres connection string' }),
 *   JWT_SECRET: str({ secret: true }),
 *   DEBUG: bool({ default: false }),
 * });
 *
 * env.PORT; // number
 */
export function createEnv<S extends Schema>(schema: S, options: CreateEnvOptions = {}): InferEnv<S> {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const source = options.env ?? processEnv;
  const paths = options.path === false ? [] : Array.isArray(options.path) ? options.path : [options.path ?? '.env.local', '.env'];
  const fromFiles = paths.length ? loadDotenvFiles(paths, source) : {};

  if (options.populateProcessEnv !== false && !options.env) {
    for (const [k, v] of Object.entries(fromFiles)) if (processEnv[k] === undefined) processEnv[k] = v;
  }

  const result: Record<string, unknown> = {};
  const issues: EnvIssue[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    const raw = source[key] ?? fromFiles[key];
    if (raw === undefined || raw === '') {
      if (spec.default !== undefined) result[key] = spec.default;
      else if (spec.optional) result[key] = undefined;
      else issues.push({ key, message: `missing${spec.desc ? ` — ${spec.desc}` : ''} (${spec.kind})` });
      continue;
    }
    try {
      result[key] = spec.parse(raw);
    } catch (err) {
      issues.push({ key, message: (err as Error).message, received: spec.secret ? '***' : JSON.stringify(raw) });
    }
  }

  if (issues.length) {
    const error = new EnvError(issues);
    const proc = (globalThis as { process?: { exit?: (c: number) => never } }).process;
    if (options.onError === 'exit' && proc?.exit) {
      console.error(`\n${error.message}\n`);
      proc.exit(1);
    }
    throw error;
  }
  return Object.freeze(result) as InferEnv<S>;
}

/**
 * Generates `.env.example` content from a schema.
 *
 * @example
 * fs.writeFileSync('.env.example', envExample(schema));
 */
export function envExample(schema: Schema): string {
  return Object.entries(schema)
    .map(([key, spec]) => {
      const notes = [spec.kind, spec.optional ? 'optional' : spec.default !== undefined ? `default: ${JSON.stringify(spec.default)}` : 'required'];
      const comment = `# ${spec.desc ? `${spec.desc} — ` : ''}${notes.join(', ')}`;
      const value = spec.example ?? (spec.default !== undefined && !spec.secret ? String(spec.default) : '');
      return `${comment}\n${key}=${value}`;
    })
    .join('\n\n')
    .concat('\n');
}
