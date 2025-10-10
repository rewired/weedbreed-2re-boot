export function expectDefined<T>(val: T | null | undefined): T {
  expect(val).toBeDefined();

  if (val === null || val === undefined) {
    throw new TypeError('Expected value to be defined.');
  }

  return val;
}

export function asObject(e: unknown): Record<string, unknown> | null {
  return isRecord(e) ? e : null;
}

export function hasKey<T extends string>(
  o: Record<string, unknown> | null,
  k: T
): o is Record<T, unknown> {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

export interface Ok<T> {
  success: true;
  data: T;
}

export interface Err<E = unknown> {
  success: false;
  error: E;
}

export function unwrap<T>(result: Ok<T>): T {
  return result.data;
}

export function unwrapErr<E>(result: Err<E>): E {
  return result.error;
}

export function toNumber(x: unknown): number {
  expect(typeof x).toBe('number');

  if (typeof x !== 'number') {
    throw new TypeError('Expected number.');
  }

  return x;
}

export function toBigInt(x: unknown): bigint {
  const isNumeric = typeof x === 'bigint' || typeof x === 'number';
  expect(isNumeric).toBe(true);

  if (typeof x === 'bigint') {
    return x;
  }

  if (typeof x === 'number') {
    return BigInt(x);
  }

  throw new TypeError('Expected bigint or number.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
