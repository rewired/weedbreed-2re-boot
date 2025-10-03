/**
 * Phase 1 Stub Implementations (Engine v1)
 *
 * Deterministic, referential stub implementations for stackable device effects.
 * Each stub provides pure functions with predefined test vectors for validation.
 *
 * @see Consolidated Reference Document: Interfaces & Stubs (Engine v1, Phase 1)
 */
export * from './ThermalActuatorStub.js';
export * from './HumidityActuatorStub.js';
export * from './LightEmitterStub.js';
export * from './NutrientBufferStub.js';
export * from './IrrigationServiceStub.js';
export * from './SensorStub.js';

export { createThermalActuatorStub } from './ThermalActuatorStub.js';
export { createHumidityActuatorStub } from './HumidityActuatorStub.js';
export { createLightEmitterStub } from './LightEmitterStub.js';
export { createSensorStub } from './SensorStub.js';
