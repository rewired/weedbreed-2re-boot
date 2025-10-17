export const TELEMETRY_TICK_COMPLETED_V1 = 'telemetry.tick.completed.v1' as const;
export interface TelemetryTickCompletedPayload {
  readonly simTimeHours: number;
  readonly targetTicksPerHour?: number;
  readonly actualTicksPerHour?: number;
  readonly operatingCostPerHour?: number;
  readonly labourCostPerHour?: number;
  readonly utilitiesCostPerHour?: number;
  readonly energyKwhPerDay?: number;
  readonly energyCostPerHour?: number;
  readonly waterCubicMetersPerDay?: number;
  readonly waterCostPerHour?: number;
}

export interface TelemetryZoneSnapshotWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'critical';
}

export interface TelemetryZoneSnapshotPayload {
  readonly zoneId: string;
  readonly simTime: number;
  readonly ppfd: number;
  readonly dli_incremental: number;
  readonly temp_c: number;
  readonly relativeHumidity01: number;
  readonly co2_ppm: number;
  readonly ach: number;
  readonly warnings: readonly TelemetryZoneSnapshotWarning[];
}

export const TELEMETRY_ZONE_SNAPSHOT_V1 = 'telemetry.zone.snapshot.v1' as const;
export const TELEMETRY_HARVEST_CREATED_V1 = 'telemetry.harvest.created.v1' as const;
export const TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1 =
  'telemetry.storage.missing_or_ambiguous.v1' as const;
export const TELEMETRY_WORKFORCE_KPI_V1 = 'telemetry.workforce.kpi.v1' as const;
export const TELEMETRY_WORKFORCE_WARNING_V1 = 'telemetry.workforce.warning.v1' as const;
export const TELEMETRY_HIRING_MARKET_SCAN_COMPLETED_V1 =
  'telemetry.hiring.market_scan.completed.v1' as const;
export const TELEMETRY_HIRING_EMPLOYEE_ONBOARDED_V1 =
  'telemetry.hiring.employee.onboarded.v1' as const;
export const TELEMETRY_WORKFORCE_PAYROLL_SNAPSHOT_V1 =
  'telemetry.workforce.payroll_snapshot.v1' as const;
export const TELEMETRY_WORKFORCE_RAISE_ACCEPTED_V1 =
  'telemetry.workforce.raise.accepted.v1' as const;
export const TELEMETRY_WORKFORCE_RAISE_BONUS_V1 =
  'telemetry.workforce.raise.bonus.v1' as const;
export const TELEMETRY_WORKFORCE_RAISE_IGNORED_V1 =
  'telemetry.workforce.raise.ignored.v1' as const;
export const TELEMETRY_WORKFORCE_EMPLOYEE_TERMINATED_V1 =
  'telemetry.workforce.employee.terminated.v1' as const;
export const TELEMETRY_HEALTH_PEST_DISEASE_RISK_V1 =
  'telemetry.health.pest_disease.risk.v1' as const;
export const TELEMETRY_HEALTH_PEST_DISEASE_TASK_V1 =
  'telemetry.health.pest_disease.task_emitted.v1' as const;
export const TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1 =
  'telemetry.device.maintenance.scheduled.v1' as const;
export const TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1 =
  'telemetry.device.replacement.recommended.v1' as const;
