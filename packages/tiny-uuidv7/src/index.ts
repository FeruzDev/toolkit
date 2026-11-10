type CryptoLike = { getRandomValues<T extends ArrayBufferView>(array: T): T; randomUUID?: () => string };

let cryptoImpl: CryptoLike | undefined;
function getCrypto(): CryptoLike {
  if (cryptoImpl) return cryptoImpl;
  const g = globalThis as { crypto?: CryptoLike; process?: { getBuiltinModule?: (id: string) => { webcrypto?: CryptoLike } } };
  if (g.crypto?.getRandomValues) return (cryptoImpl = g.crypto);
  const nodeCrypto = g.process?.getBuiltinModule?.('node:crypto');
  if (nodeCrypto?.webcrypto) return (cryptoImpl = nodeCrypto.webcrypto);
  throw new Error('tiny-uuidv7: no crypto.getRandomValues available');
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function stringify(b: Uint8Array): string {
  return (
    HEX[b[0]] + HEX[b[1]] + HEX[b[2]] + HEX[b[3]] + '-' +
    HEX[b[4]] + HEX[b[5]] + '-' +
    HEX[b[6]] + HEX[b[7]] + '-' +
    HEX[b[8]] + HEX[b[9]] + '-' +
    HEX[b[10]] + HEX[b[11]] + HEX[b[12]] + HEX[b[13]] + HEX[b[14]] + HEX[b[15]]
  );
}

// Random bytes are fetched in batches for speed.
const POOL_SIZE = 16 * 128;
let pool = new Uint8Array(0);
let poolOffset = POOL_SIZE;
function randomBytes(n: number): Uint8Array {
  if (poolOffset + n > pool.length) {
    pool = getCrypto().getRandomValues(new Uint8Array(POOL_SIZE));
    poolOffset = 0;
  }
  const out = pool.subarray(poolOffset, poolOffset + n);
  poolOffset += n;
  return out;
}

let lastMs = -1;
let counter = 0; // 12-bit sequence stored in rand_a

/**
 * Generate UUIDv7 bytes (16-byte `Uint8Array`).
 * Monotonic: IDs created in the same millisecond still sort in creation order.
 * Passing `timestamp` encodes that exact time (backfills) but is not part of the monotonic sequence.
 */
export function uuidv7Bytes(timestamp?: number): Uint8Array {
  if (timestamp !== undefined) {
    // explicit timestamp (backfill/import/tests): encode it exactly and never touch the monotonic sequence
    const r = randomBytes(2);
    return build(Math.floor(timestamp), ((r[0] << 4) | (r[1] >> 4)) & 0xfff);
  }
  let ms = Date.now();
  if (ms > lastMs) {
    lastMs = ms;
    const r = randomBytes(2);
    counter = ((r[0] << 4) | (r[1] >> 4)) & 0x7ff; // random start, top bit 0 leaves room to increment
  } else {
    // same millisecond or clock moved backwards: keep order by incrementing
    counter++;
    if (counter > 0xfff) {
      lastMs++;
      counter = 0;
    }
    ms = lastMs;
  }
  return build(ms, counter);
}

function build(ms: number, seq: number): Uint8Array {
  const bytes = new Uint8Array(16);
  // 48-bit big-endian unix timestamp in ms
  bytes[0] = (ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms >>> 24) & 0xff;
  bytes[3] = (ms >>> 16) & 0xff;
  bytes[4] = (ms >>> 8) & 0xff;
  bytes[5] = ms & 0xff;
  // version 7 + 12-bit counter
  bytes[6] = 0x70 | (seq >>> 8);
  bytes[7] = seq & 0xff;
  // variant 10 + 62 random bits
  bytes.set(randomBytes(8), 8);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

/**
 * Generate a UUIDv7 string: time-ordered, so it sorts by creation time.
 * Great as a database primary key (better index locality than UUIDv4).
 *
 * @example
 * uuidv7() // "019a6f3c-8a2b-7c4d-9e1f-2a3b4c5d6e7f"
 * [uuidv7(), uuidv7()].sort() // already in creation order
 */
export function uuidv7(timestamp?: number): string {
  return stringify(uuidv7Bytes(timestamp));
}

/** Random UUIDv4 (uses `crypto.randomUUID` when available). */
export function uuidv4(): string {
  const c = getCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = randomBytes(16).slice();
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return stringify(b);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `true` for any RFC 9562 UUID (versions 1–8) and the nil/max UUIDs. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && (UUID_RE.test(value) || /^(0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i.test(value));
}

/** `true` only for UUIDv7 strings. */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value) && value[14] === '7';
}

/** Version number of a UUID string (`7`, `4`…), or `undefined` if invalid. */
export function uuidVersion(value: string): number | undefined {
  return UUID_RE.test(value) ? parseInt(value[14], 16) : undefined;
}

/**
 * Creation time (ms since epoch) stored in a UUIDv7.
 *
 * @example
 * new Date(uuidv7Timestamp(id)).toISOString()
 */
export function uuidv7Timestamp(id: string): number {
  if (!isUuidV7(id)) throw new TypeError(`Not a UUIDv7: ${id}`);
  return parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}

/** UUID string → 16 bytes. */
export function uuidToBytes(id: string): Uint8Array {
  if (!isUuid(id)) throw new TypeError(`Not a UUID: ${id}`);
  const hex = id.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** 16 bytes → UUID string. */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new TypeError('UUID must be 16 bytes');
  return stringify(bytes);
}

/**
 * Smallest UUIDv7 for a moment in time — use for range queries:
 * `WHERE id >= uuidv7Floor(from) AND id < uuidv7Floor(to)`.
 */
export function uuidv7Floor(timestamp: number | Date): string {
  const ms = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const hex = Math.floor(ms).toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000000`;
}
