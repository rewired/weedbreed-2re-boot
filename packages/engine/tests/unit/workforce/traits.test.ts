import { describe, expect, it } from 'vitest';

import {
  TRAIT_DURATION_PRECISION_DIGITS,
  TRAIT_GREEN_THUMB_MULTIPLIER_BASE,
  TRAIT_SAMPLE_RNG_FALLBACK,
  TRAIT_SAMPLE_RNG_SEQUENCE,
  TRAIT_STRENGTH_ASSIGNMENT01,
  TRAIT_STRENGTH_HIGH01,
  TRAIT_STRENGTH_LOW01,
  TRAIT_STRENGTH_MEDIUM01,
  TRAIT_STRENGTH_PEAK01,
  TRAIT_STRENGTH_VERY_HIGH01,
  TEST_FATIGUE_DELTA,
  TEST_MORALE_DELTA,
  TEST_NIGHT_SHIFT_HOUR,
  TEST_REQUIRED_SKILL_MIN01,
  TEST_SALARY_EXPECTATION_PER_H,
  TEST_TASK_DURATION_MINUTES,
  TEST_TASK_PRIORITY_HIGH
} from '../../constants';

import {
  applyTraitEffects,
  assignTraitStrength,
  listTraitMetadata,
  resolveSkillLevel,
  sampleTraitSet,
  type TraitSubject,
} from '@/backend/src/domain/workforce/traits';

function createSubject(partial: Partial<TraitSubject>): TraitSubject {
  return {
    traits: [],
    skills: [],
    ...partial,
  } satisfies TraitSubject;
}

describe('workforce trait utilities', () => {
  it('never returns conflicting traits when sampling', () => {
    const metadata = listTraitMetadata();
    expect(metadata.length).toBeGreaterThan(0);
    const rngValues = [...TRAIT_SAMPLE_RNG_SEQUENCE];
    let index = 0;
    const rng = () => rngValues[index++ % rngValues.length] ?? TRAIT_SAMPLE_RNG_FALLBACK;

    const traits = sampleTraitSet({ rng, desiredCount: 2 });

    expect(traits).toHaveLength(2);
    const conflicts = new Set(traits.flatMap((trait) => trait.conflictsWith));
    for (const trait of traits) {
      expect(conflicts.has(trait.id)).toBe(false);
    }
  });

  it('applies multiplicative modifiers for stacked traits', () => {
    const subject = createSubject({
      traits: [
        { traitId: 'trait_green_thumb', strength01: TRAIT_STRENGTH_VERY_HIGH01 },
        { traitId: 'trait_quick_learner', strength01: TRAIT_STRENGTH_PEAK01 },
      ],
      skills: [{ skillKey: 'gardening', level01: TRAIT_STRENGTH_VERY_HIGH01 }],
    });

    const effect = applyTraitEffects(
      subject,
      {
        taskDurationMinutes: TEST_TASK_DURATION_MINUTES,
        xpRateMultiplier: 1,
      },
      {
        taskDefinition: {
          taskCode: 'test',
          description: 'Gardening task',
          requiredRoleSlug: 'gardener',
          requiredSkills: [{ skillKey: 'gardening', minSkill01: TEST_REQUIRED_SKILL_MIN01 }],
          priority: TEST_TASK_PRIORITY_HIGH,
          costModel: { basis: 'perAction', laborMinutes: TEST_TASK_DURATION_MINUTES },
        },
      },
    );

    expect(effect.values.taskDurationMinutes).toBeCloseTo(
      TEST_TASK_DURATION_MINUTES *
        (1 - TRAIT_GREEN_THUMB_MULTIPLIER_BASE * TRAIT_STRENGTH_VERY_HIGH01),
      TRAIT_DURATION_PRECISION_DIGITS
    );
    expect(effect.values.xpRateMultiplier).toBeGreaterThan(1);
  });

  it('adjusts fatigue and morale deltas for pessimistic traits', () => {
    const subject = createSubject({
      traits: [
        { traitId: 'trait_pessimist', strength01: TRAIT_STRENGTH_MEDIUM01 },
        { traitId: 'trait_night_owl', strength01: TRAIT_STRENGTH_HIGH01 },
      ],
    });

    const effect = applyTraitEffects(
      subject,
      { fatigueDelta: TEST_FATIGUE_DELTA, moraleDelta: TEST_MORALE_DELTA },
      {
        hourOfDay: TEST_NIGHT_SHIFT_HOUR,
        taskDefinition: {
          requiredSkills: [],
          taskCode: 'night',
          description: 'Night shift',
          requiredRoleSlug: 'guard',
          priority: 1,
          costModel: { basis: 'perAction', laborMinutes: 60 }
        }
      },
    );

    expect(effect.values.fatigueDelta).toBeLessThan(TEST_FATIGUE_DELTA);
    expect(effect.values.moraleDelta).toBeLessThan(TEST_MORALE_DELTA);
  });

  it('returns zero skill level when the subject lacks the skill', () => {
    const level = resolveSkillLevel(createSubject({ skills: [] }), 'maintenance');
    expect(level).toBe(0);
  });

  it('respects salary expectation adjustments from multiple traits', () => {
    const subject = createSubject({
      traits: [
        { traitId: 'trait_frugal', strength01: TRAIT_STRENGTH_LOW01 },
        { traitId: 'trait_demanding', strength01: TRAIT_STRENGTH_HIGH01 },
      ],
    });

    const effect = applyTraitEffects(subject, { salaryExpectation_per_h: TEST_SALARY_EXPECTATION_PER_H });

    expect(effect.values.salaryExpectation_per_h).toBeGreaterThan(TEST_SALARY_EXPECTATION_PER_H);
  });

  it('assigns trait strengths within the declared range', () => {
    const [metadata] = listTraitMetadata();
    const rng = () => TRAIT_STRENGTH_ASSIGNMENT01;
    const strength = assignTraitStrength(rng, metadata);
    expect(strength).toBeGreaterThanOrEqual(metadata.strengthRange.min);
    expect(strength).toBeLessThanOrEqual(metadata.strengthRange.max);
  });
});
