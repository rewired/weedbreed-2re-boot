import type {
  Employee,
  EmployeeRole,
  EmployeeSkillRequirement,
  Structure,
  WorkforceKpiSnapshot,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  WorkforceWarning,
  WorkforceTraitKind
} from '@wb/engine';
import { getTraitMetadata } from '@wb/engine';

function normalisePercent(value01: number): number {
  return Math.round(value01 * 100);
}

function accumulateCount<TKey>(map: Map<TKey, number>, key: TKey): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const GENDER_LABELS: Record<WorkforceDirectoryGender, string> = {
  m: 'Male',
  f: 'Female',
  d: 'Diverse',
  unknown: 'Unknown'
};

export type WorkforceDirectoryGender = 'm' | 'f' | 'd' | 'unknown';

export interface WorkforceFilterOption<T = string> {
  readonly value: T;
  readonly label: string;
  readonly count: number;
}

export interface WorkforceDirectoryFilters {
  readonly structures: readonly WorkforceFilterOption[];
  readonly roles: readonly WorkforceFilterOption[];
  readonly skills: readonly WorkforceFilterOption[];
  readonly genders: readonly WorkforceFilterOption<WorkforceDirectoryGender>[];
}

export interface WorkforceEmployeeSkillView {
  readonly skillKey: string;
  readonly level01: number;
  readonly levelPercent: number;
}

export interface WorkforceEmployeeSummary {
  readonly id: Employee['id'];
  readonly name: string;
  readonly roleId: EmployeeRole['id'];
  readonly roleSlug?: string;
  readonly roleName?: string;
  readonly assignedStructureId: Structure['id'];
  readonly structureName?: string;
  readonly morale01: number;
  readonly moralePercent: number;
  readonly fatigue01: number;
  readonly fatiguePercent: number;
  readonly gender: WorkforceDirectoryGender;
  readonly skills: readonly WorkforceEmployeeSkillView[];
  readonly traits: readonly WorkforceEmployeeTraitView[];
}

export interface WorkforceEmployeeDetailView extends WorkforceEmployeeSummary {
  readonly rngSeedUuid: Employee['rngSeedUuid'];
  readonly schedule: Employee['schedule'];
  readonly developmentPlan?: readonly EmployeeSkillRequirement[];
  readonly notes?: string;
}

export interface WorkforceEmployeeTraitView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: WorkforceTraitKind;
  readonly strength01: number;
  readonly strengthPercent: number;
  readonly economyHint?: string;
  readonly focusSkills: readonly string[];
}

export interface WorkforceQueueTaskView {
  readonly id: WorkforceTaskInstance['id'];
  readonly taskCode: WorkforceTaskDefinition['taskCode'];
  readonly status: WorkforceTaskInstance['status'];
  readonly priority: number;
  readonly description: string;
  readonly createdAtTick: number;
  readonly waitTimeHours?: number;
  readonly dueInHours?: number;
  readonly etaHours?: number;
  readonly requiredRoleSlug?: string;
  readonly structureId?: Structure['id'];
  readonly structureName?: string;
  readonly assignedEmployeeId?: Employee['id'];
  readonly assignedEmployeeName?: string;
}

export interface WorkforceKpiView extends WorkforceKpiSnapshot {
  readonly utilizationPercent: number;
  readonly averageMoralePercent: number;
  readonly averageFatiguePercent: number;
}

export interface WorkforceWarningView extends WorkforceWarning {
  readonly structureName?: string;
  readonly employeeName?: string;
}

export interface WorkforceViewOptions {
  readonly structures?: readonly Structure[];
  readonly simTimeHours?: number;
}

export interface WorkforceView {
  readonly directory: {
    readonly employees: readonly WorkforceEmployeeSummary[];
    readonly filters: WorkforceDirectoryFilters;
  };
  readonly employeeDetails: Readonly<Record<string, WorkforceEmployeeDetailView>>;
  readonly queue: readonly WorkforceQueueTaskView[];
  readonly latestKpi?: WorkforceKpiView;
  readonly warnings: readonly WorkforceWarningView[];
}

function resolveEmployeeGender(employee: Employee): WorkforceDirectoryGender {
  const gender = (employee as Employee & { gender?: 'm' | 'f' | 'd' }).gender;
  if (gender === 'm' || gender === 'f' || gender === 'd') {
    return gender;
  }
  return 'unknown';
}

function mapCountsToOptions<T>(
  entries: Iterable<[T, number]>,
  resolveLabel: (value: T) => string
): WorkforceFilterOption<T>[] {
  return Array.from(entries)
    .map(([value, count]) => ({
      value,
      count,
      label: resolveLabel(value)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function createWorkforceView(
  workforce: WorkforceState,
  options: WorkforceViewOptions = {}
): WorkforceView {
  const structureMap = new Map<Structure['id'], Structure>(
    (options.structures ?? []).map((structure) => [structure.id, structure])
  );
  const roleMap = new Map<EmployeeRole['id'], EmployeeRole>(
    workforce.roles.map((role) => [role.id, role])
  );
  const definitionMap = new Map<WorkforceTaskDefinition['taskCode'], WorkforceTaskDefinition>(
    workforce.taskDefinitions.map((definition) => [definition.taskCode, definition])
  );
  const employeeNameMap = new Map<Employee['id'], string>(
    workforce.employees.map((employee) => [employee.id, employee.name])
  );

  const structureCounts = new Map<Structure['id'], number>();
  const roleCounts = new Map<EmployeeRole['id'], number>();
  const skillCounts = new Map<string, number>();
  const genderCounts = new Map<WorkforceDirectoryGender, number>();

  const employees: WorkforceEmployeeSummary[] = [];
  const employeeDetails: Record<string, WorkforceEmployeeDetailView> = {};

  for (const employee of workforce.employees) {
    const role = roleMap.get(employee.roleId);
    const structureId = employee.assignedStructureId;
    const structure = structureMap.get(structureId);
    const moralePercent = normalisePercent(employee.morale01);
    const fatiguePercent = normalisePercent(employee.fatigue01);
    const gender = resolveEmployeeGender(employee);

    accumulateCount(structureCounts, structureId);
    accumulateCount(roleCounts, employee.roleId);
    accumulateCount(genderCounts, gender);

    const skills = employee.skills.map((entry) => {
      accumulateCount(skillCounts, entry.skillKey);

      return {
        skillKey: entry.skillKey,
        level01: entry.level01,
        levelPercent: normalisePercent(entry.level01)
      } satisfies WorkforceEmployeeSkillView;
    });

    const traits = (employee.traits ?? []).map((assignment) => {
      const metadata = getTraitMetadata(assignment.traitId);

      return {
        id: assignment.traitId,
        name: metadata?.name ?? assignment.traitId,
        description: metadata?.description ?? '',
        type: metadata?.type ?? 'positive',
        strength01: assignment.strength01,
        strengthPercent: normalisePercent(assignment.strength01),
        economyHint: metadata?.economyHint,
        focusSkills: metadata?.focusSkills ?? [],
      } satisfies WorkforceEmployeeTraitView;
    });

    const summary: WorkforceEmployeeSummary = {
      id: employee.id,
      name: employee.name,
      roleId: employee.roleId,
      roleSlug: role?.slug,
      roleName: role?.name,
      assignedStructureId: structureId,
      structureName: structure?.name,
      morale01: employee.morale01,
      moralePercent,
      fatigue01: employee.fatigue01,
      fatiguePercent,
      gender,
      skills,
      traits
    } satisfies WorkforceEmployeeSummary;

    employees.push(summary);

    employeeDetails[employee.id] = {
      ...summary,
      rngSeedUuid: employee.rngSeedUuid,
      schedule: employee.schedule,
      developmentPlan: employee.developmentPlan,
      notes: employee.notes
    } satisfies WorkforceEmployeeDetailView;
  }

  const structureFilters = mapCountsToOptions(structureCounts.entries(), (value) => {
    return structureMap.get(value)?.name ?? String(value);
  });

  const roleFilters = mapCountsToOptions(roleCounts.entries(), (value) => {
    const role = roleMap.get(value);
    return role?.name ?? String(value);
  });

  const skillFilters = mapCountsToOptions(skillCounts.entries(), (value) => value);

  const genderFilters = mapCountsToOptions(genderCounts.entries(), (value) => GENDER_LABELS[value]);

  const simTimeHours = options.simTimeHours;

  const queue: WorkforceQueueTaskView[] = workforce.taskQueue
    .map((task) => {
      const definition = definitionMap.get(task.taskCode);
      const structureId = typeof task.context?.structureId === 'string'
        ? (task.context.structureId as Structure['id'])
        : undefined;
      const structureName = structureId ? structureMap.get(structureId)?.name : undefined;
      const waitTimeHours =
        simTimeHours !== undefined ? Math.max(0, simTimeHours - task.createdAtTick) : undefined;
      const dueInHours =
        simTimeHours !== undefined && task.dueTick !== undefined
          ? task.dueTick - simTimeHours
          : undefined;
      const etaHours = definition ? definition.costModel.laborMinutes / 60 : undefined;
      const assignedEmployeeName = task.assignedEmployeeId
        ? employeeNameMap.get(task.assignedEmployeeId)
        : undefined;

      return {
        id: task.id,
        taskCode: task.taskCode,
        status: task.status,
        priority: definition?.priority ?? 0,
        description: definition?.description ?? task.taskCode,
        createdAtTick: task.createdAtTick,
        waitTimeHours,
        dueInHours,
        etaHours,
        requiredRoleSlug: definition?.requiredRoleSlug,
        structureId,
        structureName,
        assignedEmployeeId: task.assignedEmployeeId,
        assignedEmployeeName
      } satisfies WorkforceQueueTaskView;
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAtTick - b.createdAtTick;
    });

  const latestKpiSnapshot = workforce.kpis.at(-1);
  const latestKpi = latestKpiSnapshot
    ? ({
        ...latestKpiSnapshot,
        utilizationPercent: normalisePercent(latestKpiSnapshot.utilization01),
        averageMoralePercent: normalisePercent(latestKpiSnapshot.averageMorale01),
        averageFatiguePercent: normalisePercent(latestKpiSnapshot.averageFatigue01)
      } satisfies WorkforceKpiView)
    : undefined;

  const warnings: WorkforceWarningView[] = workforce.warnings.map((warning) => ({
    ...warning,
    structureName: warning.structureId ? structureMap.get(warning.structureId)?.name : undefined,
    employeeName: warning.employeeId ? employeeNameMap.get(warning.employeeId) : undefined
  }));

  return {
    directory: {
      employees,
      filters: {
        structures: structureFilters,
        roles: roleFilters,
        skills: skillFilters,
        genders: genderFilters
      }
    },
    employeeDetails,
    queue,
    latestKpi,
    warnings
  } satisfies WorkforceView;
}
