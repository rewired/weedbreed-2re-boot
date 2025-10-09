import type {
  EmployeeRole,
  WorkforceMarketCandidate,
  WorkforceMarketCandidateSkill,
  WorkforceMarketCandidateTrait,
  WorkforceMarketState,
  WorkforceMarketStructureState,
} from '../../domain/world.ts';
import type { Uuid } from '../../domain/schemas/primitives.ts';
import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import type { WorkforceMarketScanConfig } from '../../config/workforce.ts';
import { createRng, type RandomNumberGenerator } from '../../util/rng.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { fmtNum } from '../../util/format.ts';
import {
  assignTraitStrength,
  applyTraitEffects,
  sampleTraitSet,
  type EmployeeTraitAssignment,
  type TraitSubject,
} from '../../domain/workforce/traits.ts';
import type { EmployeeSkillLevel, EmployeeSkillTriad } from '../../domain/workforce/Employee.ts';
import {
  WORKFORCE_MARKET_BASE_SALARY_MULTIPLIER,
  WORKFORCE_MARKET_BASE_SALARY_OFFSET_PER_H,
  WORKFORCE_MARKET_MAX_FALLBACK_SKILL_COUNT,
  WORKFORCE_MARKET_PRIMARY_SKILL_BASELINE01,
  WORKFORCE_MARKET_PRIMARY_SKILL_RANGE01,
  WORKFORCE_MARKET_SECONDARY_SKILL_BASELINE01,
  WORKFORCE_MARKET_SECONDARY_SKILL_RANGE01
} from '../../constants/workforceMarket.ts';

const FALLBACK_SKILLS = [
  'gardening',
  'maintenance',
  'logistics',
  'administration',
  'cleanliness',
] as const;

function toSortedStructures(
  structures: Iterable<WorkforceMarketStructureState>,
): WorkforceMarketStructureState[] {
  return Array.from(structures).sort((a, b) => a.structureId.localeCompare(b.structureId));
}

function ensureStructureEntry(
  market: WorkforceMarketState,
  structureId: Uuid,
): WorkforceMarketStructureState {
  const existing = market.structures.find((entry) => entry.structureId === structureId);

  if (existing) {
    return existing;
  }

  return {
    structureId,
    scanCounter: 0,
    pool: [],
  } satisfies WorkforceMarketStructureState;
}

function updateStructureEntry(
  market: WorkforceMarketState,
  entry: WorkforceMarketStructureState,
): WorkforceMarketState {
  const map = new Map(market.structures.map((structure) => [structure.structureId, structure]));
  map.set(entry.structureId, entry);

  return {
    structures: toSortedStructures(map.values()),
  } satisfies WorkforceMarketState;
}

function resolveSkillUniverse(roles: readonly EmployeeRole[]): string[] {
  const universe = new Set<string>();

  for (const role of roles) {
    for (const requirement of role.coreSkills) {
      if (requirement.skillKey) {
        universe.add(requirement.skillKey);
      }
    }
  }

  if (universe.size === 0) {
    return [...FALLBACK_SKILLS];
  }

  const enriched = new Set(universe);

  for (const fallback of FALLBACK_SKILLS) {
    if (enriched.size >= WORKFORCE_MARKET_MAX_FALLBACK_SKILL_COUNT) {
      break;
    }

    if (!enriched.has(fallback)) {
      enriched.add(fallback);
    }
  }

  return Array.from(enriched);
}

function pickFrom<T>(items: readonly T[], rng: RandomNumberGenerator): T {
  const index = Math.floor(rng() * items.length) % items.length;
  return items[index];
}

function pickAndRemove<T>(items: T[], rng: RandomNumberGenerator): T {
  const index = Math.floor(rng() * items.length) % items.length;
  const [value] = items.splice(index, 1);
  return value;
}

function resolvePrimarySkillPool(role: EmployeeRole | undefined): string[] {
  const requirements = role?.coreSkills ?? [];

  if (requirements.length === 0) {
    return [];
  }

  return Array.from(new Set(requirements.map((req) => req.skillKey)));
}

function resolveSecondarySkillPool(skillUniverse: readonly string[], mainSkill: string): string[] {
  const pool = new Set(skillUniverse);
  pool.delete(mainSkill);

  for (const fallback of FALLBACK_SKILLS) {
    if (pool.size >= 2) {
      break;
    }

    if (fallback !== mainSkill) {
      pool.add(fallback);
    }
  }

  if (pool.size < 2 && skillUniverse.length > 0) {
    for (const skill of skillUniverse) {
      if (skill !== mainSkill) {
        pool.add(skill);
      }

      if (pool.size >= 2) {
        break;
      }
    }
  }

  return Array.from(pool);
}

function buildSkillBundle(
  role: EmployeeRole | undefined,
  skillUniverse: readonly string[],
  rng: RandomNumberGenerator,
): WorkforceMarketCandidate['skills3'] {
  const primaryPool = resolvePrimarySkillPool(role);
  const mainPool = primaryPool.length > 0 ? primaryPool : [...skillUniverse];
  const mainSkill = pickFrom(mainPool, rng);
  const secondaryPool = resolveSecondarySkillPool(skillUniverse, mainSkill);
  const mutablePool = [...secondaryPool];

  const secondaryA = pickAndRemove(mutablePool, rng);
  const secondaryB = mutablePool.length > 0 ? pickAndRemove(mutablePool, rng) : secondaryA;

  const main: WorkforceMarketCandidateSkill = {
    slug: mainSkill,
    value01:
      WORKFORCE_MARKET_PRIMARY_SKILL_BASELINE01 +
      rng() * WORKFORCE_MARKET_PRIMARY_SKILL_RANGE01,
  } satisfies WorkforceMarketCandidateSkill;

  const secondary: [WorkforceMarketCandidateSkill, WorkforceMarketCandidateSkill] = [
    {
      slug: secondaryA,
      value01:
        WORKFORCE_MARKET_SECONDARY_SKILL_BASELINE01 +
        rng() * WORKFORCE_MARKET_SECONDARY_SKILL_RANGE01,
    },
    {
      slug: secondaryB,
      value01:
        WORKFORCE_MARKET_SECONDARY_SKILL_BASELINE01 +
        rng() * WORKFORCE_MARKET_SECONDARY_SKILL_RANGE01,
    },
  ];

  return { main, secondary } satisfies WorkforceMarketCandidate['skills3'];
}

function buildTraitSet(rng: RandomNumberGenerator): readonly WorkforceMarketCandidateTrait[] {
  const metadata = sampleTraitSet({ rng });
  if (metadata.length === 0) {
    return [];
  }

  const assignments = metadata.map((entry) => ({
    id: entry.id,
    strength01: assignTraitStrength(rng, entry),
  } satisfies WorkforceMarketCandidateTrait));

  return assignments.sort((a, b) => a.id.localeCompare(b.id));
}

function toSkillLevels(skills3: WorkforceMarketCandidate['skills3']): EmployeeSkillLevel[] {
  const map = new Map<string, number>();
  map.set(skills3.main.slug, skills3.main.value01);
  for (const secondary of skills3.secondary) {
    if (!map.has(secondary.slug)) {
      map.set(secondary.slug, secondary.value01);
    }
  }
  return Array.from(map.entries()).map(([skillKey, level01]) => ({
    skillKey,
    level01,
  } satisfies EmployeeSkillLevel));
}

function toSkillTriad(skills3: WorkforceMarketCandidate['skills3']): EmployeeSkillTriad {
  const [secondaryFirst, secondarySecond] = skills3.secondary;
  return {
    main: { skillKey: skills3.main.slug, level01: skills3.main.value01 },
    secondary: [
      { skillKey: secondaryFirst.slug, level01: secondaryFirst.value01 },
      { skillKey: secondarySecond.slug, level01: secondarySecond.value01 }
    ],
  } satisfies EmployeeSkillTriad;
}

function createTraitSubject(
  skills3: WorkforceMarketCandidate['skills3'],
  traits: readonly WorkforceMarketCandidateTrait[],
): TraitSubject {
  const assignments: EmployeeTraitAssignment[] = traits.map((trait) => ({
    traitId: trait.id,
    strength01: trait.strength01,
  }));

  const skillTriad = toSkillTriad(skills3);

  return {
    traits: assignments,
    skills: toSkillLevels(skills3),
    skillTriad,
  } satisfies TraitSubject;
}

export interface GenerateCandidatePoolOptions {
  readonly worldSeed: string;
  readonly structureId: Uuid;
  readonly scanCounter: number;
  readonly poolSize: number;
  readonly roles: readonly EmployeeRole[];
}

export function generateCandidatePool(
  options: GenerateCandidatePoolOptions,
): WorkforceMarketCandidate[] {
  const { worldSeed, structureId, scanCounter, poolSize, roles } = options;
  const skillUniverse = resolveSkillUniverse(roles);
  const poolRng = createRng(
    worldSeed,
    `workforce:scan:${structureId}:${fmtNum(scanCounter)}`
  );

  const candidates: WorkforceMarketCandidate[] = [];

  for (let index = 0; index < poolSize; index += 1) {
    const role = roles.length > 0 ? pickFrom(roles, poolRng) : undefined;
    const candidateStreamId = `workforce:candidate:${structureId}:${fmtNum(scanCounter)}:${fmtNum(index)}`;
    const rng = createRng(worldSeed, candidateStreamId);
    const skills3 = buildSkillBundle(role, skillUniverse, rng);
    const traits = buildTraitSet(rng);
    const baseSalary_per_h =
      WORKFORCE_MARKET_BASE_SALARY_OFFSET_PER_H +
      WORKFORCE_MARKET_BASE_SALARY_MULTIPLIER * skills3.main.value01;
    const subject = createTraitSubject(skills3, traits);
    const salaryEffect = applyTraitEffects(subject, {
      salaryExpectation_per_h: baseSalary_per_h,
    });
    const expectedBaseRate_per_h =
      salaryEffect.values.salaryExpectation_per_h ?? baseSalary_per_h;

    candidates.push({
      id: deterministicUuid(worldSeed, candidateStreamId),
      structureId,
      roleSlug: role?.slug ?? 'generalist',
      skills3,
      traits,
      expectedBaseRate_per_h,
      validUntilScanCounter: scanCounter,
      scanCounter,
    });
  }

  return candidates;
}

export interface PerformMarketScanOptions {
  readonly market: WorkforceMarketState;
  readonly config: WorkforceMarketScanConfig;
  readonly worldSeed: string;
  readonly structureId: Uuid;
  readonly currentSimHours: number;
  readonly roles: readonly EmployeeRole[];
}

export interface MarketScanOutcome {
  readonly market: WorkforceMarketState;
  readonly pool?: readonly WorkforceMarketCandidate[];
  readonly scanCounter?: number;
  readonly didScan: boolean;
}

function computeCurrentSimDay(simHours: number): number {
  return Math.floor(simHours / HOURS_PER_DAY);
}

function hasCooldownElapsed(
  entry: WorkforceMarketStructureState,
  currentDay: number,
  cooldownDays: number,
): boolean {
  if (typeof entry.lastScanDay !== 'number') {
    return true;
  }

  return currentDay - entry.lastScanDay >= cooldownDays;
}

export function performMarketScan(options: PerformMarketScanOptions): MarketScanOutcome {
  const { market, config, worldSeed, structureId, currentSimHours, roles } = options;
  const structureEntry = ensureStructureEntry(market, structureId);
  const currentDay = computeCurrentSimDay(currentSimHours);

  if (!hasCooldownElapsed(structureEntry, currentDay, config.scanCooldown_days)) {
    return { market, didScan: false } satisfies MarketScanOutcome;
  }

  const nextCounter = structureEntry.scanCounter + 1;
  const pool = generateCandidatePool({
    worldSeed,
    structureId,
    scanCounter: nextCounter,
    poolSize: config.poolSize,
    roles,
  });

  const nextEntry: WorkforceMarketStructureState = {
    structureId,
    lastScanDay: currentDay,
    scanCounter: nextCounter,
    pool,
  } satisfies WorkforceMarketStructureState;

  return {
    market: updateStructureEntry(market, nextEntry),
    pool,
    scanCounter: nextCounter,
    didScan: true,
  } satisfies MarketScanOutcome;
}

export interface PerformMarketHireOptions {
  readonly market: WorkforceMarketState;
  readonly structureId: Uuid;
  readonly candidateId: Uuid;
}

export interface MarketHireOutcome {
  readonly market: WorkforceMarketState;
  readonly candidate?: WorkforceMarketCandidate;
}

export function performMarketHire(options: PerformMarketHireOptions): MarketHireOutcome {
  const { market, structureId, candidateId } = options;
  const structureEntry = ensureStructureEntry(market, structureId);
  const candidateIndex = structureEntry.pool.findIndex((entry) => entry.id === candidateId);

  if (candidateIndex < 0) {
    return { market } satisfies MarketHireOutcome;
  }

  const nextPool = structureEntry.pool.filter((_, index) => index !== candidateIndex);
  const candidate = structureEntry.pool[candidateIndex];

  const nextEntry: WorkforceMarketStructureState = {
    ...structureEntry,
    pool: nextPool,
  } satisfies WorkforceMarketStructureState;

  return {
    market: updateStructureEntry(market, nextEntry),
    candidate,
  } satisfies MarketHireOutcome;
}
