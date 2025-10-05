/**
 * Snapshot of workforce performance metrics evaluated at a specific simulation tick.
 */
export interface WorkforceKpiSnapshot {
  /** Simulation tick (in-game hour) when the KPI snapshot was generated. */
  readonly simTimeHours: number;
  /** Number of tasks completed during the previous tick window. */
  readonly tasksCompleted: number;
  /** Total labour hours committed (base hours only) in the window. */
  readonly laborHoursCommitted: number;
  /** Total overtime hours committed in the window. */
  readonly overtimeHoursCommitted: number;
  /** Average morale across active employees. */
  readonly averageMorale01: number;
  /** Average fatigue across active employees. */
  readonly averageFatigue01: number;
}
