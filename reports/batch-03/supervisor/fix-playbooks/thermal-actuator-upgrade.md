# Thermal Actuator Upgrade (Cluster: thermal-actuator-upgrade)

## Symptom
- `@typescript-eslint/no-deprecated` reports referencing `applyDeviceHeat` inside thermo tests/pipeline fixtures.

## Root-Cause
Legacy helper `applyDeviceHeat` predates Phase 6 multi-effect actuators. Tests still import it instead of `createThermalActuatorStub`, so lint fails and simulations drift from SEC §6 coupling rules.

## Canonical Fix
- Replace imports of `applyDeviceHeat` with `createThermalActuatorStub` or the Phase 6 helpers.
- Update fixtures to use new stub API returning `{ thermalDeltaC, humidityDelta01, ... }` objects.
- Remove deprecated helper re-exports once callers migrate.

```ts
import { createThermalActuatorStub } from '@/backend/src/stubs/ThermalActuatorStub.js';
const actuator = createThermalActuatorStub({ mode: 'cooling', watts: 1200 });
```

## Edge-Cases
- Integration tests expecting legacy behaviour must be updated to assert new stub contract (cooling/heating parity).
- Ensure docs reference the new stub for third-party integrators.

## Regression-Tests
- Run thermo unit tests verifying stub output equality with golden vectors.
- Pipeline integration covering heating/cooling scenarios using new stub.
