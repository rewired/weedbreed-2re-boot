/**
 * Stackable-Device-Effect-Interfaces gemäß konsolidierter Referenz (Engine v1, Phase 1).
 *
 * Diese Interfaces definieren Verträge für deterministische Stub-Implementierungen,
 * die thermische, Feuchte-, Licht-, Nährstoff-, Luftstrom-, Filtrations- und
 * Sensoreffekte modellieren. Jedes Interface folgt dem Muster:
 *
 * - `XInputs`: Eingabeparameter (Leistung, Effizienz, Kapazität, etc.)
 * - `XOutputs`: Telemetrie-Ausgaben (Deltas, Energie, Flüsse, etc.)
 * - `IX`: Interface mit `computeEffect()`-Methode
 *
 * @see Abschnitt 4 der konsolidierten Referenz für Details
 */
export * from './IThermalActuator.js';
export * from './IHumidityActuator.js';
export * from './ILightEmitter.js';
export * from './INutrientBuffer.js';
export * from './IIrrigationService.js';
export * from './IAirflowActuator.js';
export * from './IFiltrationUnit.js';
export * from './ISensor.js';

export type {
  IThermalActuator,
  ThermalActuatorInputs,
  ThermalActuatorOutputs
} from './IThermalActuator.js';
export type {
  IHumidityActuator,
  HumidityActuatorInputs,
  HumidityActuatorOutputs
} from './IHumidityActuator.js';
export type {
  ILightEmitter,
  LightEmitterInputs,
  LightEmitterOutputs
} from './ILightEmitter.js';
