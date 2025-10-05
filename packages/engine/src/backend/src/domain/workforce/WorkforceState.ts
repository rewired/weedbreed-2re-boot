import type { Employee } from './Employee.js';
import type { EmployeeRole } from './EmployeeRole.js';
import type { WorkforceKpiSnapshot } from './kpis.js';
import type { WorkforceTaskDefinition, WorkforceTaskInstance } from './tasks.js';

/**
 * Aggregated workforce domain state embedded inside the simulation world snapshot.
 */
export interface WorkforceState {
  /** Workforce role catalogue. */
  readonly roles: readonly EmployeeRole[];
  /** Deterministic directory of employees employed by the company. */
  readonly employees: readonly Employee[];
  /** Task definitions available to the scheduler. */
  readonly taskDefinitions: readonly WorkforceTaskDefinition[];
  /** Active task queue containing queued and in-progress tasks. */
  readonly taskQueue: readonly WorkforceTaskInstance[];
  /** KPI snapshots aggregated over recent simulation windows. */
  readonly kpis: readonly WorkforceKpiSnapshot[];
}
