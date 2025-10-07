import type { DomainEntity, SluggedEntity } from '../entities.js';

/**
 * Describes a unique skill requirement expressed on the normalised 0..1 scale.
 */
export interface EmployeeSkillRequirement {
  /** Canonical skill identifier shared across workforce data catalogues. */
  readonly skillKey: string;
  /** Minimum skill proficiency required to satisfy the requirement. */
  readonly minSkill01: number;
}

/**
 * Canonical representation of a workforce role as referenced by tasks and employees.
 */
export interface EmployeeRole extends DomainEntity, SluggedEntity {
  /** Free-form description highlighting responsibilities and scope. */
  readonly description?: string;
  /** Skills that are expected for any employee performing this role. */
  readonly coreSkills: readonly EmployeeSkillRequirement[];
  /** Optional list of tags that classify the role (e.g. compliance, operations). */
  readonly tags?: readonly string[];
  /**
   * Role-wide multiplier applied to the base hourly wage before employee specific
   * modifiers are evaluated. Defaults to 1 when omitted for backwards
   * compatibility with existing blueprints.
   */
  readonly baseRateMultiplier?: number;
}
