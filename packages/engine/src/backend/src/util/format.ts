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

/**
 * Formats an air temperature reading in degrees Celsius for deterministic
 * telemetry/readout strings (SEC v0.2.1 §6).
 */
export function formatTemperatureC(value: number): string {
  return `${fmtNum(value)} °C`;
}

/**
 * Formats a relative humidity delta (fractional [0,1] scale) as a percentage
 * string with sign annotation for deterministic telemetry (SEC v0.2.1 §6).
 */
export function formatHumidityDelta(delta01: number): string {
  if (!Number.isFinite(delta01)) {
    return `${fmtNum(delta01)} %RH`;
  }

  const percent = delta01 * 100;
  const sign = percent > 0 ? '+' : percent < 0 ? '-' : '';
  const magnitude = Math.abs(percent);

  return `${sign}${fmtNum(magnitude)} %RH`;
}
