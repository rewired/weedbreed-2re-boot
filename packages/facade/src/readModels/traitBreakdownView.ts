import type { WorkforceState, WorkforceTraitKind } from '@wb/engine';
import { getTraitMetadata, listTraitMetadata } from '@wb/engine';

function normalisePercent(value01: number): number {
  return Math.round(value01 * 100);
}

export interface TraitBreakdownTotals {
  readonly employeesWithTraits: number;
  readonly totalTraits: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
}

export interface TraitBreakdownEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: WorkforceTraitKind;
  readonly count: number;
  readonly averageStrength01: number;
  readonly averageStrengthPercent: number;
  readonly economyHint?: string;
  readonly focusSkills: readonly string[];
}

export interface TraitBreakdownView {
  readonly totals: TraitBreakdownTotals;
  readonly traits: readonly TraitBreakdownEntry[];
}

export function createTraitBreakdown(workforce: WorkforceState): TraitBreakdownView {
  const metadataIndex = new Map(listTraitMetadata().map((entry) => [entry.id, entry]));
  const aggregation = new Map<
    string,
    { count: number; strengthSum: number; type: WorkforceTraitKind }
  >();

  let employeesWithTraits = 0;
  let totalTraits = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (const employee of workforce.employees) {
    const traits = employee.traits ?? [];

    if (traits.length > 0) {
      employeesWithTraits += 1;
    }

    for (const assignment of traits) {
      totalTraits += 1;
      const metadata = metadataIndex.get(assignment.traitId);
      const type: WorkforceTraitKind = metadata?.type ?? 'positive';

      if (type === 'positive') {
        positiveCount += 1;
      } else {
        negativeCount += 1;
      }

      const entry = aggregation.get(assignment.traitId) ?? {
        count: 0,
        strengthSum: 0,
        type,
      };
      entry.count += 1;
      entry.strengthSum += assignment.strength01;
      aggregation.set(assignment.traitId, entry);
    }
  }

  const traits: TraitBreakdownEntry[] = Array.from(aggregation.entries())
    .map(([traitId, data]) => {
      const metadata = metadataIndex.get(traitId) ?? getTraitMetadata(traitId);
      const average = data.count > 0 ? data.strengthSum / data.count : 0;
      return {
        id: traitId,
        name: metadata?.name ?? traitId,
        description: metadata?.description ?? '',
        type: metadata?.type ?? data.type,
        count: data.count,
        averageStrength01: average,
        averageStrengthPercent: normalisePercent(average),
        economyHint: metadata?.economyHint,
        focusSkills: metadata?.focusSkills ?? [],
      } satisfies TraitBreakdownEntry;
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    totals: {
      employeesWithTraits,
      totalTraits,
      positiveCount,
      negativeCount,
    },
    traits,
  } satisfies TraitBreakdownView;
}
