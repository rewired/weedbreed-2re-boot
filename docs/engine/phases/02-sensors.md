# Phase 02 — Sensors

The `applySensors` phase executes immediately after `applyDeviceEffects` and before
`updateEnvironment`, mirroring SEC §4.2 and TDD §7. It captures deterministic sensor
readings against the pre-integration environment so downstream environment updates and
telemetry consumers share a consistent baseline.

## Inputs
- Current world snapshot with zone environment values prior to environmental integration.
- Device catalog metadata exposing `effects: ['sensor']` plus `effectConfigs.sensor` blocks.
- Engine run context providing instrumentation/diagnostic sinks and tick duration hints.

## Behaviour
1. Resolve the effective tick duration via `resolveTickHours(ctx)` (falling back to
   `HOURS_PER_TICK`) and snapshot the current simulation clock (`world.simTimeHours`).
2. Seed a deterministic RNG per device using `createRng(world.seed, 'sensor:<deviceId>')`.
3. For each sensor device:
   - Read the environment value (`trueValue`) from the zone before actuator deltas are merged.
   - Evaluate the stubbed sensor noise model, producing `{ measuredValue, error, noiseSample }`
     with clamp rules per measurement type (temperature, humidity, PPFD, CO₂).
   - Enrich the result with metadata: `measurementType`, `rngStreamId`, `sampledAtSimTimeHours`,
     `sampledTick`, `tickDurationHours`, `noise01`, `condition01`.
   - Validate the reading via `SensorReadingSchema` to guarantee finite values and canonical
     measurement ranges, then freeze it prior to storage.
4. Store readings in the per-tick runtime (`SensorReadingsRuntime`) keyed by device id, leaving
   the world snapshot untouched so `updateEnvironment` can apply actuator deltas afterwards.

## Invariants
- RNG stream ids follow the `sensor:<deviceId>` convention, ensuring deterministic telemetry.
- Measurements are always captured before `updateEnvironment` mutates zone state.
- `noiseSample` is zero when either `noise01` is zero or the device condition is perfect.
- Recorded readings expose `sampledAtSimTimeHours` and `sampledTick` derived from the same
  tick metadata used by the rest of the pipeline.

## Telemetry & Diagnostics
- Sensor diagnostics emit codes such as `sensor.config.missing` and `sensor.config.invalid`
  when devices lack configuration or request unsupported measurement types.
- Runtime readings remain available until the pipeline completes the sensor phase, allowing
  instrumentation hooks (e.g., integration tests) to inspect deterministic payloads before
  `clearSensorReadingsRuntime` runs.

## Payload Schema
Sensor readings exposed via the runtime follow the structure below (validated by
`SensorReadingSchema`):

```
{
  measurementType: 'temperature' | 'humidity' | 'ppfd' | 'co2',
  rngStreamId: 'sensor:<deviceId>',
  sampledAtSimTimeHours: number,
  sampledTick: number,
  tickDurationHours: number,
  trueValue: number,
  measuredValue: number,
  error: number,
  noise01: number,
  condition01: number,
  noiseSample: number
}
```

Values are clamped per SEC §6 sensor guidance: temperature ∈ [-50 °C, 150 °C], humidity ∈ [0, 100] %,
CO₂ ≥ 0 ppm, PPFD ≥ 0 µmol·m⁻²·s⁻¹. The schema rejects non-finite numbers or tick durations that are
not strictly positive.
