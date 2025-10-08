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
export * from './IThermalActuator.ts';
export * from './IHumidityActuator.ts';
export * from './ILightEmitter.ts';
export * from './INutrientBuffer.ts';
export * from './IIrrigationService.ts';
export * from './IAirflowActuator.ts';
export * from './IFiltrationUnit.ts';
export * from './ISensor.ts';
export * from './ICo2Injector.ts';

export type {
  IThermalActuator,
  ThermalActuatorInputs,
  ThermalActuatorOutputs
} from './IThermalActuator.ts';
export type {
  IHumidityActuator,
  HumidityActuatorInputs,
  HumidityActuatorOutputs
} from './IHumidityActuator.ts';
export type {
  ILightEmitter,
  LightEmitterInputs,
  LightEmitterOutputs
} from './ILightEmitter.ts';
export type {
  ICo2Injector,
  Co2InjectorInputs,
  Co2InjectorOutputs
} from './ICo2Injector.ts';
