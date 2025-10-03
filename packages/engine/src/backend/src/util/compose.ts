/**
 * Generic trait-composition helper adhering to SEC composition guidelines (Pattern A–E).
 *
 * Merges a list of shallow trait objects into a single aggregate object.
 * Callers must ensure method names remain unique across traits (e.g. `computeThermalEffect`,
 * `computeHumidityEffect`) to avoid accidental overwrites.
 *
 * @example
 * const splitAC = compose(
 *   createThermalActuatorStub({ power_W: 3000, efficiency01: 0.65, mode: 'cool' }),
 *   createHumidityActuatorStub({ mode: 'dehumidify', capacity_g_per_h: 500 }),
 *   createPowerConsumerStub({ power_W: 3000 }),
 * );
 *
 * @see Konsolidierte Referenz Abschnitt 6 — "So wenig Vererbung wie möglich, so viel Komposition wie nötig".
 */
export function compose<T extends object>(...traits: T[]): T {
  return traits.reduce((acc, trait) => Object.assign(acc, trait), {} as T);
}
