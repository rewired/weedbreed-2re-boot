import type { Uuid } from '../entities.js';
import type { Employee } from './Employee.js';
import type { EmployeeRole } from './EmployeeRole.js';
import type { WorkforceKpiSnapshot } from './kpis.js';
import type { WorkforceTaskDefinition, WorkforceTaskInstance } from './tasks.js';

export interface WorkforcePayrollTotals {
  readonly baseMinutes: number;
  readonly otMinutes: number;
  readonly baseCost: number;
  readonly otCost: number;
  readonly totalLaborCost: number;
}

export interface WorkforceStructurePayrollTotals extends WorkforcePayrollTotals {
  readonly structureId: Uuid;
}

export interface WorkforcePayrollState {
  readonly dayIndex: number;
  readonly totals: WorkforcePayrollTotals;
  readonly byStructure: readonly WorkforceStructurePayrollTotals[];
}

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
  /** Daily payroll accumulators capturing labour effort and costs. */
  readonly payroll: WorkforcePayrollState;
}
