/**
 * Phase 1 Stub Implementations (Engine v1)
 *
 * Deterministic, referential stub implementations for stackable device effects.
 * Each stub provides pure functions with predefined test vectors for validation.
 *
 * @see Consolidated Reference Document: Interfaces & Stubs (Engine v1, Phase 1)
 */
export * from './ThermalActuatorStub.ts';
export * from './HumidityActuatorStub.ts';
export * from './LightEmitterStub.ts';
export * from './NutrientBufferStub.ts';
export * from './IrrigationServiceStub.ts';
export * from './SensorStub.ts';
export * from './AirflowActuatorStub.ts';
export * from './FiltrationStub.ts';
export * from './Co2InjectorStub.ts';

export { createThermalActuatorStub } from './ThermalActuatorStub.ts';
export { createHumidityActuatorStub } from './HumidityActuatorStub.ts';
export { createLightEmitterStub } from './LightEmitterStub.ts';
export { createSensorStub } from './SensorStub.ts';
export { createAirflowActuatorStub } from './AirflowActuatorStub.ts';
export { createFiltrationStub } from './FiltrationStub.ts';
export { createCo2InjectorStub } from './Co2InjectorStub.ts';
