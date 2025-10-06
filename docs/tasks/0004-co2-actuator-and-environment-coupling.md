# CO₂ Actuator and Environment Coupling

**ID:** 0004  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P0  
**Tags:** backend, simulation, environment, tests

## Rationale
SEC environment rules require modelling CO₂ injection as part of the well-mixed zone bucket with device-limited rates ([SEC §6 Environment & Devices](../SEC.md#6-environment--devices-well-mixed-baseline)). The tick pipeline depends on deterministic device interfaces ([SEC Tick Pipeline](../SEC.md#tick-pipeline-canonical-9-phases); [TDD Tick Pipeline](../TDD.md#tick-pipeline-canonical-9-phases)), and maintenance/economy hooks expect energy usage from climate devices to flow into the accrual stage ([SEC §10 Economy Integration](../SEC.md#10-economy-integration-non-intrusive)). We need a CO₂ actuator interface, stub implementation, and environment coupling tests to fulfil that contract.

## Scope
- Include: define a CO₂ injector device interface with deterministic stub behaviour (flow limits, safety clamps, telemetry) and integrate it into the environment update step.
- Include: update the well-mixed environment model to incorporate CO₂ deltas from actuators alongside existing climate adjustments.
- Include: integration tests covering steady-state and ramp scenarios validating CO₂ concentration convergence and economy impacts.
- Out of scope: advanced mass-balance or spatial CO₂ models beyond the well-mixed baseline; UI visualisations.

## Deliverables
- CO₂ actuator interface definition and stub (e.g., `Co2InjectorStub`) following existing stub conventions.
- Environment coupling logic updating zone CO₂ concentration and exposing telemetry/diagnostics.
- Unit tests for the stub’s deterministic outputs and safety clamps; integration tests for steady-state and ramp scenarios.
- Documentation updates referencing the new interface and telemetry, plus CHANGELOG entry.

## Implementation Steps
1. Specify the CO₂ actuator interface in engine code (inputs: target ppm, max flow, duty; outputs: delta ppm, energy usage) referencing SEC limits.
2. Implement the stub with deterministic RNG-free behaviour, enforcing device-specified maximum injection rates and safety thresholds.
3. Extend `updateEnvironment` (or equivalent) to apply accumulated CO₂ deltas to the zone state after sensor sampling, ensuring units remain consistent.
4. Write unit tests validating stub behaviour at bounds (zero flow, max flow, clamped safety) and integration tests for steady vs ramped schedules verifying environment targets and energy accrual.
5. Update documentation (SEC notes if needed, DD/TDD references if clarifying) and record the change in CHANGELOG.

## Acceptance Criteria / DoD
- CO₂ actuator interface is defined and implemented with deterministic outputs given device spec and duty cycle; no use of `Math.random`.
- Environment update applies CO₂ deltas in the correct phase order (after sensors, before irrigation) and maintains deterministic state hashes.
- Integration tests demonstrate steady-state (holding ppm target) and ramp (increasing ppm over time) scenarios match expected concentration profiles within SEC tolerances.
- CHANGELOG and relevant docs reference the new interface and coupling.

## Tests
- Unit tests: `packages/engine/tests/unit/stubs/Co2InjectorStub.spec.ts` verifying clamp behaviour and telemetry outputs.
- Integration tests: `packages/engine/tests/integration/pipeline/co2Coupling.integration.test.ts` covering steady and ramp scenarios with hash assertions.
- CI/perf: ensure economy accrual tests still pass (per [TDD §8 Economy & Tariffs](../TDD.md#8-economy--tariffs-sec-36)) and conformance suite stays deterministic.

## Affected Files (indicative)
- `packages/engine/src/backend/src/devices/Co2Injector.ts`
- `packages/engine/src/backend/src/engine/pipeline/updateEnvironment.ts`
- `packages/engine/tests/unit/stubs/Co2InjectorStub.spec.ts`
- `packages/engine/tests/integration/pipeline/co2Coupling.integration.test.ts`
- `docs/SEC.md` ([§6](../SEC.md#6-environment--devices-well-mixed-baseline), [§10](../SEC.md#10-economy-integration-non-intrusive))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Incorrect CO₂ units causing instability. **Mitigation:** Align units with SEC/TDD conventions (ppm, mg/m³) and add validation helpers.
- **Risk:** Stage ordering regression breaking determinism. **Mitigation:** Extend tick trace tests to confirm CO₂ coupling occurs in the documented phase.
- **Risk:** Economy coupling double-counts energy. **Mitigation:** Reuse existing power→heat coupling patterns and assert accrual totals in integration tests.
