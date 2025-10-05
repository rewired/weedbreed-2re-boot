import type { DomainEntity, Uuid } from '../entities.js';
import type { EmployeeSkillRequirement } from './EmployeeRole.js';

/**
 * Brand describing UUID v7 identifiers that seed RNG streams.
 */
export type EmployeeRngSeedUuid = string & { readonly __brand: unique symbol };

/**
 * Captures the proficiency of an employee for a specific skill key.
 */
export interface EmployeeSkillLevel {
  /** Skill identifier shared across workforce catalogues. */
  readonly skillKey: string;
  /** Normalised skill level in the inclusive range [0, 1]. */
  readonly level01: number;
}

/**
 * Working hours configuration for an employee.
 */
export interface EmployeeSchedule {
  /** Planned base working hours per in-game day. */
  readonly hoursPerDay: number;
  /** Permitted overtime on top of base hours per in-game day. */
  readonly overtimeHoursPerDay: number;
  /** Number of working days planned per in-game week. */
  readonly daysPerWeek: number;
  /** Optional shift start expressed as in-game hour of day (0..23). */
  readonly shiftStartHour?: number;
}

/**
 * Canonical representation of an employee in the simulation workforce directory.
 */
export interface Employee extends DomainEntity {
  /** Identifier of the role describing this employee's responsibilities. */
  readonly roleId: Uuid;
  /** Deterministic RNG seed (UUID v7) used for stochastic employee traits. */
  readonly rngSeedUuid: EmployeeRngSeedUuid;
  /** Identifier of the structure the employee is currently assigned to. */
  readonly assignedStructureId: Uuid;
  /** Normalised morale on the inclusive range [0, 1]. */
  readonly morale01: number;
  /** Normalised fatigue on the inclusive range [0, 1]. */
  readonly fatigue01: number;
  /** Skill proficiencies mastered by the employee. */
  readonly skills: readonly EmployeeSkillLevel[];
  /** Optional skill requirements tracked for employee development. */
  readonly developmentPlan?: readonly EmployeeSkillRequirement[];
  /** Working hour policy applied to the employee. */
  readonly schedule: EmployeeSchedule;
  /** Optional free-form notes aiding HR diagnostics. */
  readonly notes?: string;
}
