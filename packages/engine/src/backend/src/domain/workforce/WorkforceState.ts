import type { Uuid } from '../entities.js';
import type { Employee } from './Employee.js';
import type { EmployeeRole } from './EmployeeRole.js';
import type { WorkforceKpiSnapshot } from './kpis.js';
import type { WorkforceTaskDefinition, WorkforceTaskInstance } from './tasks.js';
import type { WorkforceWarning } from './warnings.js';

export interface WorkforceMarketCandidateSkill {
  readonly slug: string;
  readonly value01: number;
}

export interface WorkforceMarketCandidateSkills {
  readonly main: WorkforceMarketCandidateSkill;
  readonly secondary: readonly [
    WorkforceMarketCandidateSkill,
    WorkforceMarketCandidateSkill,
  ];
}

export interface WorkforceMarketCandidateTrait {
  readonly id: string;
  readonly strength01: number;
}

export interface WorkforceMarketCandidate {
  readonly id: Uuid;
  readonly structureId: Uuid;
  readonly roleSlug: string;
  readonly skills3: WorkforceMarketCandidateSkills;
  readonly traits: readonly WorkforceMarketCandidateTrait[];
  readonly expectedBaseRate_per_h?: number;
  readonly validUntilScanCounter: number;
  readonly scanCounter: number;
}

export interface WorkforceMarketStructureState {
  readonly structureId: Uuid;
  readonly lastScanDay?: number;
  readonly scanCounter: number;
  readonly pool: readonly WorkforceMarketCandidate[];
}

export interface WorkforceMarketState {
  readonly structures: readonly WorkforceMarketStructureState[];
}

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
  /** Deterministic warnings emitted by the scheduling pipeline. */
  readonly warnings: readonly WorkforceWarning[];
  /** Daily payroll accumulators capturing labour effort and costs. */
  readonly payroll: WorkforcePayrollState;
  /** Deterministic hiring market metadata including candidate pools. */
  readonly market: WorkforceMarketState;
}
