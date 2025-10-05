/**
 * Snapshot of workforce performance metrics evaluated at a specific simulation tick.
 */
export interface WorkforceKpiSnapshot {
  /** Simulation tick (in-game hour) when the KPI snapshot was generated. */
  readonly simTimeHours: number;
  /** Number of tasks completed during the previous tick window. */
  readonly tasksCompleted: number;
  /** Number of tasks remaining in the queue after scheduling. */
  readonly queueDepth: number;
  /** Total labour hours committed (base hours only) in the window. */
  readonly laborHoursCommitted: number;
  /** Total overtime hours committed in the window. */
  readonly overtimeHoursCommitted: number;
  /** Aggregate overtime minutes committed in the window. */
  readonly overtimeMinutes: number;
  /** Utilisation ratio across the available labour capacity for the tick window. */
  readonly utilization01: number;
  /** 95th percentile wait time (in hours) for tasks completed in the window. */
  readonly p95WaitTimeHours: number;
  /** Count of queued maintenance tasks remaining after scheduling. */
  readonly maintenanceBacklog: number;
  /** Average morale across active employees. */
  readonly averageMorale01: number;
  /** Average fatigue across active employees. */
  readonly averageFatigue01: number;
}
