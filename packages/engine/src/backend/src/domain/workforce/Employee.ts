import type { BRAND } from 'zod';

import type { DomainEntity } from '../entities.js';
import type { Uuid } from '../schemas/primitives.js';
import type { EmployeeSkillRequirement } from './EmployeeRole.js';
import type { EmployeeTraitAssignment, TraitSubject } from './traits.js';

/**
 * Brand describing UUID v7 identifiers that seed RNG streams.
 */
export type EmployeeRngSeedUuid = string & BRAND<'EmployeeRngSeedUuid'>;

/**
 * Captures the proficiency of an employee for a specific skill key.
 */
export interface EmployeeSkillLevel {
  /** Skill identifier shared across workforce catalogues. */
  readonly skillKey: string;
  /** Normalised skill level in the inclusive range [0, 1]. */
  readonly level01: number;
}

export interface EmployeeSkillTriad {
  /** Primary skill focus carried over from the hiring market triad. */
  readonly main: EmployeeSkillLevel;
  /** Secondary proficiencies represented by the triad. */
  readonly secondary: readonly [EmployeeSkillLevel, EmployeeSkillLevel];
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
 * Tracks cumulative workforce experience for an employee.
 */
export interface EmployeeExperience {
  /** Total labour hours accrued over the employee's career. */
  readonly hoursAccrued: number;
  /** Normalised experience level on the inclusive range [0, 1]. */
  readonly level01: number;
}

/**
 * Raise cadence metadata recorded per employee so eligibility can be evaluated
 * deterministically.
 */
export interface EmployeeRaiseState {
  /** Sim day of the most recent raise decision when available. */
  readonly lastDecisionDay?: number;
  /** Next sim day when the employee becomes eligible for a new raise. */
  readonly nextEligibleDay?: number;
  /**
   * Sequential counter consumed by the cadence jitter stream to ensure stable
   * pseudo-random offsets.
   */
  readonly cadenceSequence: number;
}

/**
 * Canonical representation of an employee in the simulation workforce directory.
 */
export interface Employee extends DomainEntity, TraitSubject {
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
  /** Optional skill triad captured from the hiring market bundle. */
  readonly skillTriad?: EmployeeSkillTriad;
  /** Trait assignments influencing behaviour and modifiers. */
  readonly traits: readonly EmployeeTraitAssignment[];
  /** Optional skill requirements tracked for employee development. */
  readonly developmentPlan?: readonly EmployeeSkillRequirement[];
  /** Working hour policy applied to the employee. */
  readonly schedule: EmployeeSchedule;
  /** Optional free-form notes aiding HR diagnostics. */
  readonly notes?: string;
  /** Base multiplier applied on top of the role baseline for hourly compensation. */
  readonly baseRateMultiplier: number;
  /** Experience tracking metadata (total hours + normalised level). */
  readonly experience: EmployeeExperience;
  /** Labour market factor describing negotiated rate adjustments. */
  readonly laborMarketFactor: number;
  /** Multiplier applied for shift premiums such as night or weekend work. */
  readonly timePremiumMultiplier: number;
  /** Sim day (floor) when the employee started employment. */
  readonly employmentStartDay: number;
  /** Expected base hourly salary agreed with the employee. */
  readonly salaryExpectation_per_h: number;
  /** Raise cadence metadata ensuring deterministic cooldown progression. */
  readonly raise: EmployeeRaiseState;
}
