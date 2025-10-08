import type { Uuid } from '../schemas/primitives.js';
import type { EmployeeSkillRequirement } from './EmployeeRole.js';

/**
 * Supported bases for labour cost estimations inside task definitions.
 */
export type WorkforceTaskCostBasis = 'perAction' | 'perPlant' | 'perSquareMeter';

/**
 * Describes the deterministic labour cost model for a task definition.
 */
export interface WorkforceTaskCostModel {
  /** Unit on which the labour estimate is based. */
  readonly basis: WorkforceTaskCostBasis;
  /** Expected labour demand in minutes for the given basis. */
  readonly laborMinutes: number;
}

/**
 * Canonical definition of a workforce task.
 */
export interface WorkforceTaskDefinition {
  /** Unique identifier for the task definition. */
  readonly taskCode: string;
  /** Localised description template supporting token substitution. */
  readonly description: string;
  /** Role slug required to execute the task. */
  readonly requiredRoleSlug: string;
  /** Skills and minimum proficiency thresholds required to perform the task. */
  readonly requiredSkills: readonly EmployeeSkillRequirement[];
  /** Deterministic priority weight for scheduling. */
  readonly priority: number;
  /** Labour cost model used for scheduling and economic projections. */
  readonly costModel: WorkforceTaskCostModel;
}

/**
 * Instance representation of a queued or active workforce task.
 */
export interface WorkforceTaskInstance {
  /** Unique identifier of the task instance. */
  readonly id: Uuid;
  /** Code referencing the originating task definition. */
  readonly taskCode: WorkforceTaskDefinition['taskCode'];
  /** Current lifecycle state of the task. */
  readonly status: 'queued' | 'in-progress' | 'completed' | 'cancelled';
  /** Simulation tick (hour) at which the task was created. */
  readonly createdAtTick: number;
  /** Optional simulation tick when the task must be completed. */
  readonly dueTick?: number;
  /** Identifier of the employee assigned to the task, if any. */
  readonly assignedEmployeeId?: Uuid;
  /** Additional contextual data to support assignment heuristics. */
  readonly context?: Record<string, unknown>;
}
