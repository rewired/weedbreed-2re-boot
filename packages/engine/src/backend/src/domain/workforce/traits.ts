import traitsJson from '../../../../../../../data/personnel/traits.json' with { type: 'json' };

import { clamp01 } from '../../util/math.js';
import type { RandomNumberGenerator } from '../../util/rng.js';
import type { EmployeeSchedule, EmployeeSkillLevel, EmployeeSkillTriad } from './Employee.js';
import type { WorkforceTaskDefinition } from './tasks.js';

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

const DEFAULT_STRENGTH_RANGE: TraitStrengthRange = { min: 0.35, max: 0.75 };

const RAW_TRAITS = traitsJson as readonly {
  readonly id: WorkforceTraitId;
  readonly name: string;
  readonly description: string;
  readonly type: WorkforceTraitKind;
}[];

const TRAIT_BEHAVIOUR: Record<WorkforceTraitId, TraitBehaviour> = {
  trait_green_thumb: {
    focusSkills: ['gardening'],
    strengthRange: { min: 0.45, max: 0.8 },
    effects: (subject, strength01, context) => {
      const skillKeys = resolveContextSkills(context);
      const applies = skillKeys.some((skill) => skill === 'gardening');
      if (!applies) {
        return {};
      }
      const multiplier = 1 - 0.18 * strength01;
      return {
        taskDurationMultiplier: clampMultiplier(multiplier),
        taskErrorDelta: -0.03 * strength01,
        xpRateMultiplier: 1 + 0.08 * strength01,
      } satisfies TraitEffectContribution;
    },
  },
  trait_night_owl: {
    effects: (_subject, strength01, context) => {
      const hour = context.hourOfDay ?? 12;
      const isNight = hour >= 20 || hour < 6;
      if (!isNight) {
        return {};
      }
      return {
        taskDurationMultiplier: clampMultiplier(1 - 0.1 * strength01),
        fatigueMultiplier: clampMultiplier(1 - 0.2 * strength01),
        moraleDelta: 0.02 * strength01,
      } satisfies TraitEffectContribution;
    },
  },
  trait_quick_learner: {
    conflictsWith: ['trait_slow_learner'],
    strengthRange: { min: 0.55, max: 0.85 },
    effects: () => ({ xpRateMultiplier: 1.2 }),
  },
  trait_optimist: {
    conflictsWith: ['trait_pessimist'],
    effects: () => ({ moraleDelta: 0.03 }),
  },
  trait_gearhead: {
    focusSkills: ['maintenance'],
    strengthRange: { min: 0.4, max: 0.7 },
    effects: (_subject, strength01) => ({
      deviceWearMultiplier: clampMultiplier(1 - 0.25 * strength01),
      taskErrorDelta: -0.02 * strength01,
    }),
  },
  trait_frugal: {
    conflictsWith: ['trait_demanding'],
    economyHint: 'Accepts a lower base salary expectation.',
    effects: (_subject, strength01, _context, base) => {
      const baseline = base.salaryExpectation_per_h ?? 0;
      const reduction = Math.max(0.5, baseline * 0.05) * strength01;
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
        taskErrorDelta: applies ? -0.05 * strength01 : -0.02 * strength01,
        fatigueMultiplier: clampMultiplier(1 - 0.05 * strength01),
      } satisfies TraitEffectContribution;
    },
  },
  trait_clumsy: {
    conflictsWith: ['trait_meticulous'],
    effects: (_subject, strength01) => ({
      taskErrorDelta: 0.06 * strength01,
      deviceWearMultiplier: clampMultiplier(1 + 0.12 * strength01),
    }),
  },
  trait_slacker: {
    conflictsWith: ['trait_meticulous'],
    effects: (_subject, strength01) => ({
      taskDurationMultiplier: clampMultiplier(1 + 0.12 * strength01),
      fatigueMultiplier: clampMultiplier(1 + 0.18 * strength01),
      xpRateMultiplier: 1 - 0.08 * strength01,
    }),
  },
  trait_pessimist: {
    conflictsWith: ['trait_optimist'],
    effects: () => ({ moraleDelta: -0.035 }),
  },
  trait_forgetful: {
    effects: (_subject, strength01) => ({
      taskDurationMultiplier: clampMultiplier(1 + 0.08 * strength01),
      taskErrorDelta: 0.025 * strength01,
    }),
  },
  trait_demanding: {
    conflictsWith: ['trait_frugal'],
    economyHint: 'Negotiates higher salaries relative to peers.',
    effects: (_subject, strength01, _context, base) => {
      const baseline = base.salaryExpectation_per_h ?? 0;
      const premium = Math.max(1, baseline * 0.08) * strength01;
      return { salaryExpectationDelta_per_h: premium } satisfies TraitEffectContribution;
    },
  },
  trait_slow_learner: {
    conflictsWith: ['trait_quick_learner'],
    effects: () => ({ xpRateMultiplier: 0.82 }),
  },
};

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(0.25, Math.min(1.75, value));
}

function resolveBehaviour(traitId: WorkforceTraitId): TraitBehaviour {
  return TRAIT_BEHAVIOUR[traitId] ?? {};
}

function resolveContextSkills(context: TraitEffectContext): readonly string[] {
  const definition = context.taskDefinition;
  if (!definition) {
    return [];
  }
  return definition.requiredSkills?.map((skill) => skill.skillKey) ?? [];
}

const WORKFORCE_TRAIT_METADATA_MUTABLE = new Map<WorkforceTraitId, WorkforceTraitMetadata>(
  RAW_TRAITS.map((trait) => {
    const behaviour = resolveBehaviour(trait.id);
    const conflicts = new Set(behaviour.conflictsWith ?? []);
    const metadata: WorkforceTraitMetadata = {
      id: trait.id,
      name: trait.name,
      description: trait.description,
      type: trait.type,
      conflictsWith: [...conflicts],
      strengthRange: behaviour.strengthRange ?? DEFAULT_STRENGTH_RANGE,
      economyHint: behaviour.economyHint,
      focusSkills: behaviour.focusSkills ?? [],
    };
    return [trait.id, metadata];
  }),
);

function ensureBidirectionalConflicts(
  metadataMap: Map<WorkforceTraitId, WorkforceTraitMetadata>,
): void {
  for (const metadata of metadataMap.values()) {
    const behaviour = resolveBehaviour(metadata.id);
    for (const conflict of behaviour.conflictsWith ?? []) {
      const other = metadataMap.get(conflict);
      if (!other) {
        continue;
      }
      const otherConflicts = new Set(resolveBehaviour(conflict).conflictsWith ?? []);
      if (!otherConflicts.has(metadata.id)) {
        otherConflicts.add(metadata.id);
        TRAIT_BEHAVIOUR[conflict] = {
          ...resolveBehaviour(conflict),
          conflictsWith: [...otherConflicts],
        } satisfies TraitBehaviour;
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
  const count = options.desiredCount ?? (rng() < 0.5 ? 1 : 2);
  const pool = listTraitMetadata();
  const available = [...pool];
  const selected: WorkforceTraitMetadata[] = [];

  while (selected.length < count && available.length > 0) {
    const index = Math.floor(rng() * available.length) % available.length;
    const candidate = available.splice(index, 1)[0];
    const conflicts = new Set(resolveBehaviour(candidate.id).conflictsWith ?? []);
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

  for (const assignment of subject.traits ?? []) {
    const metadata = WORKFORCE_TRAIT_METADATA.get(assignment.traitId);
    if (!metadata) {
      continue;
    }

    const behaviour = resolveBehaviour(metadata.id);
    const contribution = behaviour.effects?.(subject, clamp01(assignment.strength01), context, base) ?? {};
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

  for (const entry of subject.skills ?? []) {
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
