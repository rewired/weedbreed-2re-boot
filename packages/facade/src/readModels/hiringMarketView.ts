/* eslint-disable wb-sim/no-ts-import-js-extension */

import type {
  Structure,
  WorkforceConfig,
  WorkforceMarketCandidate,
  WorkforceMarketState,
  WorkforceState,
} from '@wb/engine';
import { DEFAULT_WORKFORCE_CONFIG } from '@/backend/src/config/workforce.js';

function toPercent(value01: number): number {
  return Math.round(value01 * 100);
}

export interface HiringMarketCandidateSkillView {
  readonly slug: string;
  readonly value01: number;
  readonly valuePercent: number;
  readonly kind: 'main' | 'secondary';
}

export interface HiringMarketCandidateTraitView {
  readonly id: string;
  readonly strength01: number;
  readonly strengthPercent: number;
}

export interface HiringMarketCandidateView {
  readonly id: WorkforceMarketCandidate['id'];
  readonly roleSlug: string;
  readonly expectedBaseRate_per_h?: number;
  readonly skills: readonly HiringMarketCandidateSkillView[];
  readonly traits: readonly HiringMarketCandidateTraitView[];
  readonly validUntilScanCounter: number;
  readonly scanCounter: number;
}

export interface HiringMarketStructureView {
  readonly structureId: Structure['id'];
  readonly structureName?: string;
  readonly lastScanDay?: number;
  readonly scanCounter: number;
  readonly cooldownRemainingDays?: number;
  readonly pool: readonly HiringMarketCandidateView[];
}

export interface HiringMarketConfigView {
  readonly scanCooldownDays: number;
  readonly poolSize: number;
  readonly scanCostCc: number;
}

export interface HiringMarketViewOptions {
  readonly structures?: readonly Structure[];
  readonly simDay?: number;
  readonly config?: WorkforceConfig['market'];
}

export interface HiringMarketView {
  readonly config: HiringMarketConfigView;
  readonly structures: readonly HiringMarketStructureView[];
}

function mapSkills(candidate: WorkforceMarketCandidate): HiringMarketCandidateSkillView[] {
  const skills: HiringMarketCandidateSkillView[] = [
    {
      slug: candidate.skills3.main.slug,
      value01: candidate.skills3.main.value01,
      valuePercent: toPercent(candidate.skills3.main.value01),
      kind: 'main',
    },
  ];

  for (const secondary of candidate.skills3.secondary) {
    skills.push({
      slug: secondary.slug,
      value01: secondary.value01,
      valuePercent: toPercent(secondary.value01),
      kind: 'secondary',
    });
  }

  return skills;
}

function mapTraits(candidate: WorkforceMarketCandidate): HiringMarketCandidateTraitView[] {
  return candidate.traits.map((trait) => ({
    id: trait.id,
    strength01: trait.strength01,
    strengthPercent: toPercent(trait.strength01),
  }));
}

function computeCooldownRemaining(
  lastScanDay: number | undefined,
  simDay: number | undefined,
  cooldownDays: number,
): number | undefined {
  if (typeof simDay !== 'number') {
    return undefined;
  }

  if (typeof lastScanDay !== 'number') {
    return 0;
  }

  const elapsed = simDay - lastScanDay;
  const remaining = cooldownDays - elapsed;
  return remaining > 0 ? remaining : 0;
}

function mapStructure(
  structure: WorkforceMarketState['structures'][number],
  structureLookup: Map<Structure['id'], Structure>,
  options: HiringMarketViewOptions,
): HiringMarketStructureView {
  const building = structureLookup.get(structure.structureId);
  const config = options.config;

  return {
    structureId: structure.structureId,
    structureName: building?.name,
    lastScanDay: structure.lastScanDay,
    scanCounter: structure.scanCounter,
    cooldownRemainingDays: config
      ? computeCooldownRemaining(structure.lastScanDay, options.simDay, config.scanCooldown_days)
      : undefined,
    pool: structure.pool.map((candidate) => ({
      id: candidate.id,
      roleSlug: candidate.roleSlug,
      expectedBaseRate_per_h: candidate.expectedBaseRate_per_h,
      skills: mapSkills(candidate),
      traits: mapTraits(candidate),
      validUntilScanCounter: candidate.validUntilScanCounter,
      scanCounter: candidate.scanCounter,
    })),
  } satisfies HiringMarketStructureView;
}

function resolveConfig(config?: WorkforceConfig['market']): HiringMarketConfigView {
  const resolved = config ?? DEFAULT_WORKFORCE_CONFIG.market;

  return {
    scanCooldownDays: resolved.scanCooldown_days,
    poolSize: resolved.poolSize,
    scanCostCc: resolved.scanCost_cc,
  } satisfies HiringMarketConfigView;
}

export function createHiringMarketView(
  workforce: WorkforceState,
  options: HiringMarketViewOptions = {},
): HiringMarketView {
  const structureLookup = new Map<Structure['id'], Structure>(
    (options.structures ?? []).map((structure) => [structure.id, structure]),
  );
  const configView = resolveConfig(options.config);

  const structures = workforce.market.structures.map((entry) =>
    mapStructure(entry, structureLookup, options),
  );

  return {
    config: configView,
    structures,
  } satisfies HiringMarketView;
}
