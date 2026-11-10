# tiny-uuidv7

[![npm](https://img.shields.io/npm/v/tiny-uuidv7.svg)](https://www.npmjs.com/package/tiny-uuidv7)
[![size](https://img.shields.io/bundlephobia/minzip/tiny-uuidv7)](https://bundlephobia.com/package/tiny-uuidv7)
[![license](https://img.shields.io/npm/l/tiny-uuidv7.svg)](./LICENSE)

**Time-sortable UUIDs (UUIDv7, RFC 9562) in ~1 KB.** Monotonic, zero dependencies, works in browsers, Node, Bun, Deno and edge runtimes.

```ts
import { uuidv7 } from 'tiny-uuidv7';

const id = uuidv7(); // "019a6f3c-8a2b-7c4d-9e1f-2a3b4c5d6e7f"
```

## Why UUIDv7?

UUIDv7 starts with a millisecond timestamp, so IDs **sort by creation time**:

- 🗄️ **Better database primary keys** than UUIDv4: new rows go to the end of the B-tree index (less page splitting, faster inserts in Postgres/MySQL).
- 📅 You can read the creation time back from the ID.
- 🔀 Still globally unique without coordination, and a standard `uuid` column type.

This package is **monotonic**: IDs generated in the same millisecond still sort in creation order (12-bit counter, RFC 9562 method 1), even if the system clock moves backwards.

## Install

```bash
npm install tiny-uuidv7
```

## API

```ts
import {
  uuidv7, uuidv7Bytes, uuidv7Timestamp, uuidv7Floor,
  uuidv4, isUuid, isUuidV7, uuidVersion, uuidToBytes, bytesToUuid,
} from 'tiny-uuidv7';

uuidv7();                          // new time-ordered id
uuidv7(Date.UTC(2020, 0, 1));      // id for an exact time (backfills; not part of the monotonic sequence)
uuidv7Bytes();                     // Uint8Array(16)
new Date(uuidv7Timestamp(id));     // creation time
uuidv7Floor(new Date('2026-01-01')); // smallest id of that ms — for range queries

uuidv4();                          // random UUID (crypto.randomUUID when available)
isUuid(value);                     // any RFC 9562 UUID
isUuidV7(value);                   // UUIDv7 only
uuidVersion(id);                   // 7
```

### Range queries by time

```sql
-- all orders created in January, using only the primary key index
SELECT * FROM orders WHERE id >= $1 AND id < $2;
```

```ts
db.query(sql, [uuidv7Floor(new Date('2026-01-01')), uuidv7Floor(new Date('2026-02-01'))]);
```

### With ORMs

```ts
// Drizzle
id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),

// Prisma
const user = await prisma.user.create({ data: { id: uuidv7(), name } });

// TypeORM
@PrimaryColumn('uuid') id: string = uuidv7();
```

## Comparison

| | tiny-uuidv7 | uuid | nanoid | ulid |
| --- | --- | --- | --- | --- |
| Time-sortable | ✅ | v7 ✅ | ❌ | ✅ |
| Standard UUID column | ✅ | ✅ | ❌ | ❌ |
| Monotonic within 1 ms | ✅ | ✅ | – | ✅ |
| Extract timestamp | ✅ | ❌ | ❌ | ✅ |
| Size (min+gz) | ~1 KB | ~4 KB (whole lib) | ~0.2 KB | ~1.5 KB |

Randomness comes from `crypto.getRandomValues` (cryptographically secure).

## License

MIT
