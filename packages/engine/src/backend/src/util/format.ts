/**
 * Ensures unknown values are converted into string form without triggering
 * template literal restrictions that disallow direct interpolation of
 * non-string types.
 */
export function toStr(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

/**
 * Stable numeric formatter for log and diagnostic strings inside the engine.
 * UI layers remain responsible for locale-aware presentation.
 */
export function fmtNum(value: number): string {
  return Number.isFinite(value) ? value.toString() : String(value);
}
