/** @jest-environment node */
import { uuidv7, uuidv7Bytes, uuidv4, isUuid, isUuidV7, uuidVersion, uuidv7Timestamp, uuidToBytes, bytesToUuid, uuidv7Floor } from '../src';

describe('uuidv7', () => {
  it('has the right format, version and variant', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isUuidV7(id)).toBe(true);
    expect(uuidVersion(id)).toBe(7);
  });

  it('encodes the timestamp', () => {
    const t = Date.UTC(2026, 10, 10, 12, 0, 0, 123);
    expect(uuidv7Timestamp(uuidv7(t))).toBe(t);
    const now = Date.now();
    expect(Math.abs(uuidv7Timestamp(uuidv7()) - now)).toBeLessThan(1000);
  });

  it('is unique and strictly increasing, even within one millisecond', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(5_000_000_000_000);
    const ids = Array.from({ length: 50_000 }, () => uuidv7());
    spy.mockRestore();
    expect(new Set(ids).size).toBe(ids.length);
    let sorted = true;
    for (let i = 1; i < ids.length; i++) if (!(ids[i] > ids[i - 1])) sorted = false;
    expect(sorted).toBe(true);
  });

  it('stays monotonic when the system clock goes backwards', () => {
    const spy = jest.spyOn(Date, 'now');
    spy.mockReturnValue(4_000_000_000_000);
    const a = uuidv7();
    spy.mockReturnValue(3_999_999_999_000);
    const b = uuidv7();
    spy.mockRestore();
    expect(b > a).toBe(true);
  });

  it('encodes explicit past timestamps exactly (backfills)', () => {
    uuidv7();
    const past = Date.UTC(2020, 0, 1);
    expect(uuidv7Timestamp(uuidv7(past))).toBe(past);
  });

  it('bytes round-trip', () => {
    const bytes = uuidv7Bytes();
    expect(bytes).toHaveLength(16);
    const id = bytesToUuid(bytes);
    expect(uuidToBytes(id)).toEqual(bytes);
  });

  it('uuidv7Floor sorts before ids of the same millisecond', () => {
    const t = 1_900_000_000_000;
    const floor = uuidv7Floor(t);
    expect(uuidv7Timestamp(floor)).toBe(t);
    expect(uuidv7(t + 1) > floor).toBe(true);
    expect(uuidv7Floor(new Date(t))).toBe(floor);
  });
});

describe('helpers', () => {
  it('uuidv4 and validation', () => {
    const v4 = uuidv4();
    expect(uuidVersion(v4)).toBe(4);
    expect(isUuid(v4)).toBe(true);
    expect(isUuidV7(v4)).toBe(false);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(() => uuidv7Timestamp(v4)).toThrow('Not a UUIDv7');
  });
});
