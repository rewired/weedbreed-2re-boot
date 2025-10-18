# Socket.IO Telemetry Schemas

Task 2130 documents the Socket.IO telemetry topics the UI consumes for Tasks 4100–4130. These schemas mirror the façade contracts and
align with SEC §4 (telemetry) and DD §4 (data interchange). Each topic lists required and optional fields plus a deterministic sample
payload developers can replay in Storybook or local tools.

> All values follow per-hour economy units and canonical [0,1] scaling for quality/morale as defined in SEC v0.2.1.

## `telemetry.tick.completed.v1`

| Field | Required | Notes |
| --- | --- | --- |
| `simTimeHours` | ✅ | Integer simulation hour counter. |
| `targetTicksPerHour` | ➖ | Expected tick cadence; useful for detecting slowdowns. |
| `actualTicksPerHour` | ➖ | Observed cadence over the last wall-clock window. |
| `operatingCostPerHour` | ➖ | Total operating expenditure per in-game hour. |
| `labourCostPerHour` | ➖ | Workforce spend per in-game hour. |
| `utilitiesCostPerHour` | ➖ | Aggregate utilities cost per in-game hour. |
| `energyKwhPerDay` | ➖ | Dailyised energy usage derived from per-hour draw. |
| `energyCostPerHour` | ➖ | Per-hour electricity cost (post tariff resolution). |
| `waterCubicMetersPerDay` | ➖ | Dailyised water usage derived from per-hour consumption. |
| `waterCostPerHour` | ➖ | Per-hour water cost (post tariff resolution). |

```json
{
  "simTimeHours": 72,
  "targetTicksPerHour": 1,
  "operatingCostPerHour": 125.5,
  "labourCostPerHour": 82.25,
  "utilitiesCostPerHour": 43.25
}
```

## `telemetry.zone.snapshot.v1`

| Field | Required | Notes |
| --- | --- | --- |
| `zoneId` | ✅ | Zone identifier (UUID or deterministic slug). |
| `simTime` | ✅ | Tick number when the snapshot was captured. |
| `ppfd` | ✅ | Photosynthetic photon flux density (µmol/m²/s). |
| `dli_incremental` | ✅ | Delta daily light integral accumulated this tick. |
| `temp_c` | ✅ | Zone temperature in °C. |
| `relativeHumidity01` | ✅ | Relative humidity on [0,1] scale. |
| `co2_ppm` | ✅ | CO₂ concentration (ppm). |
| `ach` | ✅ | Air changes per hour. |
| `warnings` | ➖ | Array of warning envelopes (`code`, `message`, `severity ∈ {'info','warning','critical'}`). |

```json
{
  "zoneId": "zone-001",
  "simTime": 72,
  "ppfd": 650,
  "dli_incremental": 35.2,
  "temp_c": 24.5,
  "relativeHumidity01": 0.6,
  "co2_ppm": 900,
  "ach": 12,
  "warnings": [
    {
      "code": "humidity-high",
      "message": "Relative humidity trending above target.",
      "severity": "warning"
    }
  ]
}
```

## `telemetry.workforce.kpi.v1`

| Field | Required | Notes |
| --- | --- | --- |
| `snapshot.simTimeHours` | ✅ | Simulation hour when KPIs were sampled. |
| `snapshot.tasksCompleted` | ✅ | Tasks completed during the sampled window. |
| `snapshot.queueDepth` | ✅ | Outstanding task queue depth. |
| `snapshot.laborHoursCommitted` | ✅ | Total labour hours scheduled. |
| `snapshot.overtimeHoursCommitted` | ✅ | Overtime hours currently planned. |
| `snapshot.overtimeMinutes` | ✅ | Overtime minutes (redundant convenience metric). |
| `snapshot.p95WaitTimeHours` | ✅ | 95th percentile wait time for pending tasks (hours). |
| `snapshot.maintenanceBacklog` | ✅ | Outstanding maintenance task count. |
| `snapshot.utilization01` | ✅ | Workforce utilisation on [0,1]. |
| `snapshot.averageMorale01` | ✅ | Average morale [0,1]. |
| `snapshot.averageFatigue01` | ✅ | Average fatigue [0,1]. |

```json
{
  "snapshot": {
    "simTimeHours": 72,
    "tasksCompleted": 18,
    "queueDepth": 2,
    "laborHoursCommitted": 24,
    "overtimeHoursCommitted": 1.5,
    "overtimeMinutes": 90,
    "p95WaitTimeHours": 1.25,
    "maintenanceBacklog": 3,
    "utilization01": 0.58,
    "averageMorale01": 0.74,
    "averageFatigue01": 0.41
  }
}
```

### Frontend Integration Notes (Tasks 4100–4130)

- Task 4100: Bind the dashboard telemetry widgets to the tick topic to drive live clock, cost rollups, and utilisation baselines.
- Task 4110: Use the `zoneId` and climate fields to select the active zone card and derive deviation badges.
- Task 4120: Hydrate the zone dashboard charts by combining `ppfd`, `dli_incremental`, and warning severities.
- Task 4130: Feed the workforce dashboard KPIs from the snapshot payload. Normalise `[0,1]` fields to percentages for display.

For deterministic tests, reuse the schema metadata in `packages/transport-sio/src/contracts/events.ts` and the Vitest samples under
`packages/transport-sio/tests/unit/telemetrySchemas.test.ts`.
