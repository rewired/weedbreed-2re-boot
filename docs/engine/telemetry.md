# Engine Telemetry Topics

The simulation emits read-only telemetry in alignment with SEC §15. The table below maps every engine topic to its payload contract, producer, and known consumers.

| Topic | Payload shape | Producer(s) | Consumer(s) |
| --- | --- | --- | --- |
| `telemetry.harvest.created.v1` | `{ structureId, roomId, plantId, zoneId, lotId, createdAt_tick, freshWeight_kg, moisture01, quality01 }` | `applyHarvestAndInventory` pipeline stage | Seed-to-harvest report generator; monitoring pipelines |
| `telemetry.storage.missing_or_ambiguous.v1` | `{ structureId, candidateRoomIds, reason }` where `reason ∈ {'not_found','ambiguous'}` | `applyHarvestAndInventory` when `resolveStorageRoomForStructure` fails | Diagnostics/monitoring dashboards |
| `telemetry.workforce.kpi.v1` | `{ snapshot: WorkforceKpiSnapshot }` | `applyWorkforce` via `emitWorkforceKpiSnapshot` | `packages/tools-monitor` runtime (live KPI panel) |
| `telemetry.workforce.warning.v1` | `{ warnings: WorkforceWarning[] }` | `applyWorkforce` via `emitWorkforceWarnings` | `packages/tools-monitor` runtime (warning ticker) |
| `telemetry.workforce.payroll_snapshot.v1` | `{ snapshot: WorkforcePayrollState }` | `applyWorkforce` via `emitWorkforcePayrollSnapshot` | `packages/tools-monitor` runtime (payroll module) |
| `telemetry.workforce.raise.accepted.v1` | `{ event: WorkforceRaiseTelemetryEvent }` (`action` fixed to `accept`) | `applyWorkforce` when raises are accepted | Planned façade/read-model consumers |
| `telemetry.workforce.raise.bonus.v1` | `{ event: WorkforceRaiseTelemetryEvent }` (`action` fixed to `bonus`) | `applyWorkforce` when discretionary bonuses issue | Planned façade/read-model consumers |
| `telemetry.workforce.raise.ignored.v1` | `{ event: WorkforceRaiseTelemetryEvent }` (`action` fixed to `ignore`) | `applyWorkforce` when raises are ignored | Planned façade/read-model consumers |
| `telemetry.workforce.employee.terminated.v1` | `{ event: WorkforceTerminationTelemetryEvent }` | `applyWorkforce` during terminations | Planned façade/read-model consumers |
| `telemetry.hiring.market_scan.completed.v1` | `HiringMarketScanTelemetryPayload` (`{ structureId, simDay, scanCounter, poolSize, cost_cc }`) | Hiring service (`emitHiringMarketScanCompleted`) | Workforce monitoring/ops tooling |
| `telemetry.hiring.employee.onboarded.v1` | `{ employeeId, structureId }` | Hiring service (`emitHiringEmployeeOnboarded`) | Workforce monitoring/ops tooling |
| `telemetry.health.pest_disease.risk.v1` | `{ warnings: PestDiseaseRiskWarning[] }` | Health system (`emitPestDiseaseRiskWarnings`) | `packages/tools-monitor` runtime (pest warning board) |
| `telemetry.health.pest_disease.task_emitted.v1` | `{ events: PestDiseaseTaskEvent[] }` | Health system (`emitPestDiseaseTaskEvents`) | `packages/tools-monitor` runtime (task log) |
| `telemetry.device.maintenance.scheduled.v1` | `{ taskId, deviceId, structureId?, roomId?, zoneId?, startTick, endTick, serviceHours, reason, serviceVisitCostCc }` | `applyWorkforce` maintenance planner | `packages/tools-monitor` runtime (maintenance log) |
| `telemetry.device.replacement.recommended.v1` | `{ deviceId, structureId?, roomId?, zoneId?, recommendedSinceTick, totalMaintenanceCostCc, replacementCostCc }` | `applyWorkforce` maintenance planner | `packages/tools-monitor` runtime (replacement alerts) |

> Payload type aliases originate from `packages/engine/src/backend/src/telemetry/*.ts` modules unless otherwise noted.
