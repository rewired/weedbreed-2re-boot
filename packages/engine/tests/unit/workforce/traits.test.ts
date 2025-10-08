import { describe, expect, it } from 'vitest';

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
    const rngValues = [0.2, 0.8, 0.1, 0.7, 0.6];
    let index = 0;
    const rng = () => rngValues[index++ % rngValues.length] ?? 0.3;

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
        { traitId: 'trait_green_thumb', strength01: 0.7 },
        { traitId: 'trait_quick_learner', strength01: 0.8 },
      ],
      skills: [{ skillKey: 'gardening', level01: 0.7 }],
    });

    const effect = applyTraitEffects(
      subject,
      {
        taskDurationMinutes: 120,
        xpRateMultiplier: 1,
      },
      {
        taskDefinition: {
          taskCode: 'test',
          description: 'Gardening task',
          requiredRoleSlug: 'gardener',
          requiredSkills: [{ skillKey: 'gardening', minSkill01: 0.4 }],
          priority: 10,
          costModel: { basis: 'perAction', laborMinutes: 120 },
        },
      },
    );

    expect(effect.values.taskDurationMinutes).toBeCloseTo(120 * (1 - 0.18 * 0.7), 5);
    expect(effect.values.xpRateMultiplier).toBeGreaterThan(1);
  });

  it('adjusts fatigue and morale deltas for pessimistic traits', () => {
    const subject = createSubject({
      traits: [
        { traitId: 'trait_pessimist', strength01: 0.5 },
        { traitId: 'trait_night_owl', strength01: 0.6 },
      ],
    });

    const effect = applyTraitEffects(
      subject,
      { fatigueDelta: 0.4, moraleDelta: -0.05 },
      { hourOfDay: 22, taskDefinition: { requiredSkills: [], taskCode: 'night', description: 'Night shift', requiredRoleSlug: 'guard', priority: 1, costModel: { basis: 'perAction', laborMinutes: 60 } } },
    );

    expect(effect.values.fatigueDelta).toBeLessThan(0.4);
    expect(effect.values.moraleDelta).toBeLessThan(-0.05);
  });

  it('returns zero skill level when the subject lacks the skill', () => {
    const level = resolveSkillLevel(createSubject({ skills: [] }), 'maintenance');
    expect(level).toBe(0);
  });

  it('respects salary expectation adjustments from multiple traits', () => {
    const subject = createSubject({
      traits: [
        { traitId: 'trait_frugal', strength01: 0.4 },
        { traitId: 'trait_demanding', strength01: 0.6 },
      ],
    });

    const effect = applyTraitEffects(subject, { salaryExpectation_per_h: 25 });

    expect(effect.values.salaryExpectation_per_h).toBeGreaterThan(25);
  });

  it('assigns trait strengths within the declared range', () => {
    const [metadata] = listTraitMetadata();
    const rng = () => 0.95;
    const strength = assignTraitStrength(rng, metadata);
    expect(strength).toBeGreaterThanOrEqual(metadata.strengthRange.min);
    expect(strength).toBeLessThanOrEqual(metadata.strengthRange.max);
  });
});
