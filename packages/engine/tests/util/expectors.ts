export function expectDefined<T>(val: T | null | undefined): T {
  expect(val).toBeDefined();
  return val as T;
}

export function asObject(e: unknown): Record<string, unknown> | null {
  return e && typeof e === 'object' ? (e as Record<string, unknown>) : null;
}

export function hasKey<T extends string>(
  o: Record<string, unknown> | null,
  k: T
): o is Record<T, unknown> {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

export function toNumber(x: unknown): number {
  expect(typeof x).toBe('number');
  return x as number;
}

export function toBigInt(x: unknown): bigint {
  expect(typeof x === 'bigint' || typeof x === 'number').toBe(true);
  return typeof x === 'bigint' ? x : BigInt(x as number);
}
