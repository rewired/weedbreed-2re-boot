import traitsJson from '../../../../../../../data/personnel/traits.json' with { type: 'json' };

import { clamp01 } from '../../util/math.ts';
import type { RandomNumberGenerator } from '../../util/rng.ts';
import type { EmployeeSchedule, EmployeeSkillLevel, EmployeeSkillTriad } from './Employee.ts';
import type { WorkforceTaskDefinition } from './tasks.ts';
import {
  DEFAULT_TRAIT_STRENGTH_MIN,
  DEFAULT_TRAIT_STRENGTH_MAX,
  GREEN_THUMB_TRAIT_STRENGTH_MIN,
  GREEN_THUMB_TRAIT_STRENGTH_MAX,
  GREEN_THUMB_TASK_DURATION_FACTOR,
  GREEN_THUMB_TASK_ERROR_FACTOR,
  GREEN_THUMB_XP_RATE_FACTOR,
  NIGHT_OWL_TASK_DURATION_FACTOR,
  NIGHT_OWL_FATIGUE_FACTOR,
  NIGHT_OWL_MORALE_FACTOR,
  NIGHT_OWL_START_HOUR,
  NIGHT_OWL_END_HOUR,
  QUICK_LEARNER_TRAIT_STRENGTH_MIN,
  QUICK_LEARNER_TRAIT_STRENGTH_MAX,
  QUICK_LEARNER_XP_RATE_MULTIPLIER,
  OPTIMIST_MORALE_DELTA,
  GEARHEAD_TRAIT_STRENGTH_MIN,
  GEARHEAD_TRAIT_STRENGTH_MAX,
  GEARHEAD_DEVICE_WEAR_FACTOR,
  GEARHEAD_TASK_ERROR_FACTOR,
  FRUGAL_SALARY_REDUCTION_MIN,
  FRUGAL_SALARY_REDUCTION_FACTOR,
  METICULOUS_TASK_ERROR_FACTOR_SKILL,
  METICULOUS_TASK_ERROR_FACTOR_NO_SKILL,
  METICULOUS_FATIGUE_FACTOR,
  CLUMSY_TASK_ERROR_FACTOR,
  CLUMSY_DEVICE_WEAR_FACTOR,
  SLACKER_TASK_DURATION_FACTOR,
  SLACKER_FATIGUE_FACTOR,
  SLACKER_XP_RATE_FACTOR,
  PESSIMIST_MORALE_DELTA,
  FORGETFUL_TASK_DURATION_FACTOR,
  FORGETFUL_TASK_ERROR_FACTOR,
  DEMANDING_SALARY_PREMIUM_MIN,
  DEMANDING_SALARY_PREMIUM_FACTOR,
  SLOW_LEARNER_XP_RATE_MULTIPLIER,
  MULTIPLIER_CLAMP_MIN,
  MULTIPLIER_CLAMP_MAX
} from '../../constants/simConstants.ts';

export type WorkforceTraitId = (typeof traitsJson)[number]['id'];
export type WorkforceTraitKind = (typeof traitsJson)[number]['type'];

export interface TraitStrengthRange {
  readonly min: number;
  readonly max: number;
}

export interface EmployeeTraitAssignment {
  readonly traitId: WorkforceTraitId;
  readonly strength01: number;
}

export interface TraitSubject {
  readonly traits: readonly EmployeeTraitAssignment[];
  readonly skills?: readonly EmployeeSkillLevel[];
  readonly skillTriad?: EmployeeSkillTriad;
  readonly schedule?: EmployeeSchedule;
}

export interface TraitEffectContribution {
  readonly taskDurationMultiplier?: number;
  readonly taskErrorDelta?: number;
  readonly fatigueDelta?: number;
  readonly fatigueMultiplier?: number;
  readonly moraleDelta?: number;
  readonly deviceWearMultiplier?: number;
  readonly xpRateMultiplier?: number;
  readonly salaryExpectationDelta_per_h?: number;
}

export interface TraitEffectBreakdownEntry extends TraitEffectContribution {
  readonly traitId: WorkforceTraitId;
  readonly strength01: number;
}

export interface TraitEffectBaseValues {
  readonly taskDurationMinutes?: number;
  readonly taskErrorRate01?: number;
  readonly fatigueDelta?: number;
  readonly moraleDelta?: number;
  readonly deviceWearMultiplier?: number;
  readonly xpRateMultiplier?: number;
  readonly salaryExpectation_per_h?: number;
}

export interface TraitEffectContext {
  readonly taskDefinition?: WorkforceTaskDefinition;
  readonly hourOfDay?: number;
  readonly isBreakTask?: boolean;
}

export interface TraitEffectResult {
  readonly values: TraitEffectBaseValues;
  readonly breakdown: readonly TraitEffectBreakdownEntry[];
}

interface TraitBehaviour {
  readonly conflictsWith?: readonly WorkforceTraitId[];
  readonly strengthRange?: TraitStrengthRange;
  readonly focusSkills?: readonly string[];
  readonly effects?: (
    subject: TraitSubject,
    strength01: number,
    context: TraitEffectContext,
    base: TraitEffectBaseValues,
  ) => TraitEffectContribution;
  readonly economyHint?: string;
}

export interface WorkforceTraitMetadata {
  readonly id: WorkforceTraitId;
  readonly name: string;
  readonly description: string;
  readonly type: WorkforceTraitKind;
  readonly conflictsWith: readonly WorkforceTraitId[];
  readonly strengthRange: TraitStrengthRange;
  readonly economyHint?: string;
  readonly focusSkills: readonly string[];
}

const DEFAULT_STRENGTH_RANGE: TraitStrengthRange = { min: DEFAULT_TRAIT_STRENGTH_MIN, max: DEFAULT_TRAIT_STRENGTH_MAX };
const DEFAULT_CONTEXT_HOUR = 12;
const SECOND_TRAIT_SELECTION_THRESHOLD = 0.5;
const EMPTY_TRAIT_LIST: readonly WorkforceTraitId[] = Object.freeze([]);
const EMPTY_SKILL_LIST: readonly string[] = Object.freeze([]);

const RAW_TRAITS = traitsJson as readonly {
  readonly id: WorkforceTraitId;
  readonly name: string;
  readonly description: string;
  readonly type: WorkforceTraitKind;
}[];

const TRAIT_BEHAVIOUR: Record<WorkforceTraitId, TraitBehaviour> = {
  trait_green_thumb: {
    focusSkills: ['gardening'],
    strengthRange: { min: GREEN_THUMB_TRAIT_STRENGTH_MIN, max: GREEN_THUMB_TRAIT_STRENGTH_MAX },
    effects: (subject, strength01, context) => {
      const skillKeys = resolveContextSkills(context);
      const applies = skillKeys.some((skill) => skill === 'gardening');
      if (!applies) {
        return {};
      }
      const multiplier = 1 - GREEN_THUMB_TASK_DURATION_FACTOR * strength01;
      return {
        taskDurationMultiplier: clampMultiplier(multiplier),
        taskErrorDelta: -GREEN_THUMB_TASK_ERROR_FACTOR * strength01,
        xpRateMultiplier: 1 + GREEN_THUMB_XP_RATE_FACTOR * strength01,
      } satisfies TraitEffectContribution;
    },
  },
  trait_night_owl: {
    effects: (_subject, strength01, context) => {
      const hour = context.hourOfDay ?? DEFAULT_CONTEXT_HOUR;
      const isNight = hour >= NIGHT_OWL_START_HOUR || hour < NIGHT_OWL_END_HOUR;
      if (!isNight) {
        return {};
      }
      return {
        taskDurationMultiplier: clampMultiplier(1 - NIGHT_OWL_TASK_DURATION_FACTOR * strength01),
        fatigueMultiplier: clampMultiplier(1 - NIGHT_OWL_FATIGUE_FACTOR * strength01),
        moraleDelta: NIGHT_OWL_MORALE_FACTOR * strength01,
      } satisfies TraitEffectContribution;
    },
  },
  trait_quick_learner: {
    conflictsWith: ['trait_slow_learner'],
    strengthRange: { min: QUICK_LEARNER_TRAIT_STRENGTH_MIN, max: QUICK_LEARNER_TRAIT_STRENGTH_MAX },
    effects: () => ({ xpRateMultiplier: QUICK_LEARNER_XP_RATE_MULTIPLIER }),
  },
  trait_optimist: {
    conflictsWith: ['trait_pessimist'],
    effects: () => ({ moraleDelta: OPTIMIST_MORALE_DELTA }),
  },
  trait_gearhead: {
    focusSkills: ['maintenance'],
    strengthRange: { min: GEARHEAD_TRAIT_STRENGTH_MIN, max: GEARHEAD_TRAIT_STRENGTH_MAX },
    effects: (_subject, strength01) => ({
      deviceWearMultiplier: clampMultiplier(1 - GEARHEAD_DEVICE_WEAR_FACTOR * strength01),
      taskErrorDelta: -GEARHEAD_TASK_ERROR_FACTOR * strength01,
    }),
  },
  trait_frugal: {
    conflictsWith: ['trait_demanding'],
    economyHint: 'Accepts a lower base salary expectation.',
    effects: (_subject, strength01, _context, base) => {
      const baseline = base.salaryExpectation_per_h ?? 0;
      const reduction = Math.max(FRUGAL_SALARY_REDUCTION_MIN, baseline * FRUGAL_SALARY_REDUCTION_FACTOR) * strength01;
      return { salaryExpectationDelta_per_h: -reduction } satisfies TraitEffectContribution;
    },
  },
  trait_meticulous: {
    focusSkills: ['cleanliness'],
    conflictsWith: ['trait_clumsy', 'trait_slacker'],
    effects: (_subject, strength01, context) => {
      const skillKeys = resolveContextSkills(context);
      const applies = skillKeys.some((skill) => skill === 'cleanliness');
      return {
        taskErrorDelta: applies ? -METICULOUS_TASK_ERROR_FACTOR_SKILL * strength01 : -METICULOUS_TASK_ERROR_FACTOR_NO_SKILL * strength01,
        fatigueMultiplier: clampMultiplier(1 - METICULOUS_FATIGUE_FACTOR * strength01),
      } satisfies TraitEffectContribution;
    },
  },
  trait_clumsy: {
    conflictsWith: ['trait_meticulous'],
    effects: (_subject, strength01) => ({
      taskErrorDelta: CLUMSY_TASK_ERROR_FACTOR * strength01,
      deviceWearMultiplier: clampMultiplier(1 + CLUMSY_DEVICE_WEAR_FACTOR * strength01),
    }),
  },
  trait_slacker: {
    conflictsWith: ['trait_meticulous'],
    effects: (_subject, strength01) => ({
      taskDurationMultiplier: clampMultiplier(1 + SLACKER_TASK_DURATION_FACTOR * strength01),
      fatigueMultiplier: clampMultiplier(1 + SLACKER_FATIGUE_FACTOR * strength01),
      xpRateMultiplier: 1 - SLACKER_XP_RATE_FACTOR * strength01,
    }),
  },
  trait_pessimist: {
    conflictsWith: ['trait_optimist'],
    effects: () => ({ moraleDelta: PESSIMIST_MORALE_DELTA }),
  },
  trait_forgetful: {
    effects: (_subject, strength01) => ({
      taskDurationMultiplier: clampMultiplier(1 + FORGETFUL_TASK_DURATION_FACTOR * strength01),
      taskErrorDelta: FORGETFUL_TASK_ERROR_FACTOR * strength01,
    }),
  },
  trait_demanding: {
    conflictsWith: ['trait_frugal'],
    economyHint: 'Negotiates higher salaries relative to peers.',
    effects: (_subject, strength01, _context, base) => {
      const baseline = base.salaryExpectation_per_h ?? 0;
      const premium = Math.max(DEMANDING_SALARY_PREMIUM_MIN, baseline * DEMANDING_SALARY_PREMIUM_FACTOR) * strength01;
      return { salaryExpectationDelta_per_h: premium } satisfies TraitEffectContribution;
    },
  },
  trait_slow_learner: {
    conflictsWith: ['trait_quick_learner'],
    effects: () => ({ xpRateMultiplier: SLOW_LEARNER_XP_RATE_MULTIPLIER }),
  },
};

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(MULTIPLIER_CLAMP_MIN, Math.min(MULTIPLIER_CLAMP_MAX, value));
}

function resolveBehaviour(traitId: WorkforceTraitId): TraitBehaviour | undefined {
  return TRAIT_BEHAVIOUR[traitId];
}

function resolveContextSkills(context: TraitEffectContext): readonly string[] {
  const definition = context.taskDefinition;
  if (!definition) {
    return [];
  }
  return definition.requiredSkills.map((skill) => skill.skillKey);
}

const WORKFORCE_TRAIT_METADATA_MUTABLE = new Map<WorkforceTraitId, WorkforceTraitMetadata>(
  RAW_TRAITS.map((trait) => {
    const behaviour = resolveBehaviour(trait.id);
    const conflicts = new Set(behaviour?.conflictsWith ?? EMPTY_TRAIT_LIST);
    const metadata: WorkforceTraitMetadata = {
      id: trait.id,
      name: trait.name,
      description: trait.description,
      type: trait.type,
      conflictsWith: [...conflicts],
      strengthRange: behaviour?.strengthRange ?? DEFAULT_STRENGTH_RANGE,
      economyHint: behaviour?.economyHint,
      focusSkills: behaviour?.focusSkills ?? EMPTY_SKILL_LIST,
    };
    return [trait.id, metadata];
  }),
);

function ensureBidirectionalConflicts(
  metadataMap: Map<WorkforceTraitId, WorkforceTraitMetadata>,
): void {
  for (const metadata of metadataMap.values()) {
    const behaviour = resolveBehaviour(metadata.id);
    if (!behaviour) {
      continue;
    }
    for (const conflict of behaviour.conflictsWith ?? EMPTY_TRAIT_LIST) {
      const other = metadataMap.get(conflict);
      if (!other) {
        continue;
      }
      const existingBehaviour = resolveBehaviour(conflict);
      const otherConflicts = new Set(existingBehaviour?.conflictsWith ?? EMPTY_TRAIT_LIST);
      if (!otherConflicts.has(metadata.id)) {
        otherConflicts.add(metadata.id);
        const updatedBehaviour: TraitBehaviour = {
          ...(existingBehaviour ?? {}),
          conflictsWith: [...otherConflicts],
        };
        TRAIT_BEHAVIOUR[conflict] = updatedBehaviour;
        metadataMap.set(conflict, {
          ...other,
          conflictsWith: [...otherConflicts],
        });
      }
    }
  }
}

ensureBidirectionalConflicts(WORKFORCE_TRAIT_METADATA_MUTABLE);

export const WORKFORCE_TRAIT_METADATA: ReadonlyMap<WorkforceTraitId, WorkforceTraitMetadata> =
  WORKFORCE_TRAIT_METADATA_MUTABLE;

export function listTraitMetadata(): readonly WorkforceTraitMetadata[] {
  return Array.from(WORKFORCE_TRAIT_METADATA.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function getTraitMetadata(id: WorkforceTraitId): WorkforceTraitMetadata | undefined {
  return WORKFORCE_TRAIT_METADATA.get(id);
}

export interface SampleTraitSetOptions {
  readonly rng: RandomNumberGenerator;
  readonly desiredCount?: number;
}

export function sampleTraitSet(options: SampleTraitSetOptions): readonly WorkforceTraitMetadata[] {
  const { rng } = options;
  const count = options.desiredCount ?? (rng() < SECOND_TRAIT_SELECTION_THRESHOLD ? 1 : 2);
  const pool = listTraitMetadata();
  const available = [...pool];
  const selected: WorkforceTraitMetadata[] = [];

  while (selected.length < count && available.length > 0) {
    const index = Math.floor(rng() * available.length) % available.length;
    const candidate = available.splice(index, 1)[0];
    const behaviour = resolveBehaviour(candidate.id);
    const conflicts = new Set(behaviour?.conflictsWith ?? EMPTY_TRAIT_LIST);
    const hasConflict = selected.some((entry) => conflicts.has(entry.id));

    if (hasConflict) {
      continue;
    }

    selected.push(candidate);
  }

  return selected.sort((a, b) => a.id.localeCompare(b.id));
}

export function assignTraitStrength(
  rng: RandomNumberGenerator,
  metadata: WorkforceTraitMetadata,
): number {
  const range = metadata.strengthRange;
  const span = Math.max(0, range.max - range.min);
  const strength = range.min + rng() * span;
  return clamp01(strength);
}

export function applyTraitEffects(
  subject: TraitSubject,
  base: TraitEffectBaseValues,
  context: TraitEffectContext = {},
): TraitEffectResult {
  const breakdownMap = new Map<WorkforceTraitId, TraitEffectContribution & { strength01: number }>();
  let durationMultiplier = 1;
  let errorDelta = 0;
  let fatigueAdd = 0;
  let fatigueMultiplier = 1;
  let moraleAdd = 0;
  let deviceWearMultiplier = base.deviceWearMultiplier ?? 1;
  let xpMultiplier = base.xpRateMultiplier ?? 1;
  let salaryDelta = 0;

  for (const assignment of subject.traits) {
    const metadata = WORKFORCE_TRAIT_METADATA.get(assignment.traitId);
    if (!metadata) {
      continue;
    }

    const behaviour = resolveBehaviour(metadata.id);
    if (!behaviour) {
      continue;
    }
    const contribution =
      behaviour.effects?.(subject, clamp01(assignment.strength01), context, base) ?? {};
    const existing = breakdownMap.get(metadata.id) ?? { strength01: assignment.strength01 };

    if (contribution.taskDurationMultiplier !== undefined) {
      durationMultiplier *= clampMultiplier(contribution.taskDurationMultiplier);
      existing.taskDurationMultiplier =
        (existing.taskDurationMultiplier ?? 1) * clampMultiplier(contribution.taskDurationMultiplier);
    }

    if (contribution.taskErrorDelta !== undefined) {
      errorDelta += contribution.taskErrorDelta;
      existing.taskErrorDelta = (existing.taskErrorDelta ?? 0) + contribution.taskErrorDelta;
    }

    if (contribution.fatigueDelta !== undefined) {
      fatigueAdd += contribution.fatigueDelta;
      existing.fatigueDelta = (existing.fatigueDelta ?? 0) + contribution.fatigueDelta;
    }

    if (contribution.fatigueMultiplier !== undefined) {
      fatigueMultiplier *= clampMultiplier(contribution.fatigueMultiplier);
      existing.fatigueMultiplier =
        (existing.fatigueMultiplier ?? 1) * clampMultiplier(contribution.fatigueMultiplier);
    }

    if (contribution.moraleDelta !== undefined) {
      moraleAdd += contribution.moraleDelta;
      existing.moraleDelta = (existing.moraleDelta ?? 0) + contribution.moraleDelta;
    }

    if (contribution.deviceWearMultiplier !== undefined) {
      deviceWearMultiplier *= clampMultiplier(contribution.deviceWearMultiplier);
      existing.deviceWearMultiplier =
        (existing.deviceWearMultiplier ?? 1) * clampMultiplier(contribution.deviceWearMultiplier);
    }

    if (contribution.xpRateMultiplier !== undefined) {
      xpMultiplier *= clampMultiplier(contribution.xpRateMultiplier);
      existing.xpRateMultiplier =
        (existing.xpRateMultiplier ?? 1) * clampMultiplier(contribution.xpRateMultiplier);
    }

    if (contribution.salaryExpectationDelta_per_h !== undefined) {
      salaryDelta += contribution.salaryExpectationDelta_per_h;
      existing.salaryExpectationDelta_per_h =
        (existing.salaryExpectationDelta_per_h ?? 0) + contribution.salaryExpectationDelta_per_h;
    }

    breakdownMap.set(metadata.id, existing);
  }

  const values: TraitEffectBaseValues = {
    taskDurationMinutes:
      base.taskDurationMinutes !== undefined ? base.taskDurationMinutes * durationMultiplier : undefined,
    taskErrorRate01:
      base.taskErrorRate01 !== undefined ? clamp01(base.taskErrorRate01 + errorDelta) : undefined,
    fatigueDelta:
      base.fatigueDelta !== undefined
        ? base.fatigueDelta * fatigueMultiplier + fatigueAdd
        : undefined,
    moraleDelta: base.moraleDelta !== undefined ? base.moraleDelta + moraleAdd : undefined,
    deviceWearMultiplier,
    xpRateMultiplier: xpMultiplier,
    salaryExpectation_per_h:
      base.salaryExpectation_per_h !== undefined ? base.salaryExpectation_per_h + salaryDelta : undefined,
  } satisfies TraitEffectBaseValues;

  const breakdown: TraitEffectBreakdownEntry[] = Array.from(breakdownMap.entries())
    .map(([traitId, contribution]) => ({ traitId, ...contribution }))
    .sort((a, b) => a.traitId.localeCompare(b.traitId));

  return { values, breakdown } satisfies TraitEffectResult;
}

export function resolveSkillLevel(subject: TraitSubject, skillKey: string): number {
  const normalised = skillKey.toLowerCase();
  const byKey = new Map<string, number>();

  const skillEntries = subject.skills ?? [];
  for (const entry of skillEntries) {
    byKey.set(entry.skillKey.toLowerCase(), clamp01(entry.level01));
  }

  const triad = subject.skillTriad;
  if (triad) {
    byKey.set(triad.main.skillKey.toLowerCase(), clamp01(triad.main.level01));
    for (const secondary of triad.secondary) {
      if (!byKey.has(secondary.skillKey.toLowerCase())) {
        byKey.set(secondary.skillKey.toLowerCase(), clamp01(secondary.level01));
      }
    }
  }

  return byKey.get(normalised) ?? 0;
}
