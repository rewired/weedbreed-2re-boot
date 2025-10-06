# Sensors Stage Content and Noise Model

**ID:** 0003  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P0  
**Tags:** backend, simulation, tests

## Rationale
The ordered tick pipeline mandates sensor sampling immediately after device effects and before environment updates ([SEC Tick Pipeline](../SEC.md#tick-pipeline-canonical-9-phases); [TDD Tick Pipeline](../TDD.md#tick-pipeline-canonical-9-phases)). CHANGELOG entry [#54 WB-047](../CHANGELOG.md#54-wb-047-sensor-sampling-before-environment-integration) locked in that sequencing, and [Interface & Stub proposal §5 Pattern D](../proposals/20251002-interface_stubs.md#pattern-d--sensor--aktuator-in-einem-geh%C3%A4use) explains deterministic noise expectations. We must formalize the sensor stage schema, deterministic noise injection, and ordering validation so the engine stays compliant.

## Scope
- Include: define canonical sensor output schema (per-sensor readings, timestamps, diagnostics) and deterministic noise hooks consistent with stub guidance.
- Include: ensure the stage snapshots environment inputs before `updateEnvironment`, emitting immutable readings for downstream telemetry/tasks.
- Include: tests that assert stage order and deterministic noise behaviour, including integration coverage of sensor+actuator devices.
- Out of scope: introducing new sensor device types beyond what SEC already enumerates; refactoring downstream environment aggregation logic.

## Deliverables
- Sensor stage module documentation/spec describing the payload structure and deterministic noise source binding (`createRng` stream ids).
- Updated engine implementation capturing sensor outputs before environment merge, with clamps/units enforced.
- Unit tests for noise utilities and schema validation; integration tests covering Pattern D sensor+actuator flows.
- CHANGELOG note referencing the finalized sensor stage behaviour.

## Implementation Steps
1. Document the sensor stage contract (fields, units, RNG streams) in code comments and, if needed, supplemental docs under `docs/engine/` referencing SEC/TDD.
2. Update `applySensors` (or equivalent) to snapshot environment state prior to mutation, apply deterministic noise via dedicated RNG streams, and return structured sensor readings.
3. Ensure the tick runner maintains the canonical stage order (`applySensors` before `updateEnvironment`) and add assertions/trace checks mirroring TDD guidance.
4. Add Vitest coverage: unit specs for sensor schema/noise, integration spec for sensor+actuator device verifying readings reflect pre-environment state.
5. Record the change in CHANGELOG with links back to SEC/TDD references.

## Acceptance Criteria / DoD
- Sensor outputs include deterministic raw reading and noise metadata per sensor type, using RNG streams scoped like `sensor:<id>` and reproducible across runs.
- Stage trace from `runTick(..., { trace: true })` shows `applySensors` immediately after `applyDeviceEffects` and before `updateEnvironment`; tests fail if order changes.
- Pattern D integration test demonstrates that the sensor reading captures the pre-actuation environment state for the same tick and remains stable with noise=0.
- Documentation/CHANGELOG updated with the finalized contract.

## Tests
- Unit tests: `packages/engine/tests/unit/sensors/noise.spec.ts` for RNG/noise determinism; schema parser tests ensuring fields are finite and clamped.
- Integration tests: `packages/engine/tests/integration/pipeline/sensorActuatorPattern.integration.test.ts` extended to assert pre/post environment behaviour and deterministic noise; tick trace test verifying stage order.
- CI gate: existing pipeline trace test from [TDD §Tick Pipeline](../TDD.md#tick-pipeline-canonical-9-phases) must pass with new assertions.

## Affected Files (indicative)
- `packages/engine/src/backend/src/engine/pipeline/applySensors.ts`
- `packages/engine/tests/unit/sensors/*.spec.ts`
- `packages/engine/tests/integration/pipeline/sensorActuatorPattern.integration.test.ts`
- `docs/CHANGELOG.md` ([#54](../CHANGELOG.md#54-wb-047-sensor-sampling-before-environment-integration))
- `docs/proposals/20251002-interface_stubs.md` ([Pattern D](../proposals/20251002-interface_stubs.md#pattern-d--sensor--aktuator-in-einem-geh%C3%A4use))
- `docs/SEC.md` ([Tick Pipeline](../SEC.md#tick-pipeline-canonical-9-phases))

## Risks & Mitigations
- **Risk:** Noise model introduces drift. **Mitigation:** Bind all noise to deterministic RNG streams with documented seeds and add golden vector tests.
- **Risk:** Stage order regressions slip through. **Mitigation:** Extend tick trace integration tests to assert explicit ordering and fail on deviation.
- **Risk:** Schema churn breaks telemetry consumers. **Mitigation:** Version sensor payload schema and update façade/read-model tests accordingly.
