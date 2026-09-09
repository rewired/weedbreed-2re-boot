import { parseStrainBlueprint, type StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import { createRng, type RandomNumberGenerator } from '../util/rng.ts';
import { deterministicUuid } from '../util/uuid.ts';
import type { CrossF1Input, F1Candidate } from './types.ts';

const VARIATION01 = 0.08;
const RANGE_VARIATION01 = 0.02;
const DECIMAL_PLACES = 12;
const MIN_RANGE_WIDTH = 0.000001;

function rounded(value: number): number { return Number(value.toFixed(DECIMAL_PLACES)); }
function clamp01(value: number): number { return rounded(Math.max(0, Math.min(1, value))); }

function mix(a: number, b: number, rng: RandomNumberGenerator, variation = VARIATION01): number {
  const midpoint = (a + b) / 2;
  return rounded(midpoint + (rng() - 0.5) * variation * Math.max(Math.abs(a - b), Math.abs(midpoint), 1));
}

function mixRecord(a: Record<string, number> | undefined, b: Record<string, number> | undefined, rng: RandomNumberGenerator, unitInterval: boolean): Record<string, number> | undefined {
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort();
  if (keys.length === 0) return undefined;
  return Object.fromEntries(keys.map((key) => {
    const value = mix(a?.[key] ?? b?.[key] ?? 0, b?.[key] ?? a?.[key] ?? 0, rng);
    return [key, unitInterval ? clamp01(value) : Math.max(0, value)];
  }));
}

function mixGenotype(a: Record<string, number> | undefined, b: Record<string, number> | undefined, rng: RandomNumberGenerator): Record<string, number> {
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {}), 'sativa', 'indica', 'ruderalis'])].sort();
  const raw = keys.map((key) => Math.max(0, mix(a?.[key] ?? 0, b?.[key] ?? 0, rng)));
  const sum = raw.reduce((total, value) => total + value, 0);
  const values = sum > 0 ? raw.map((value) => rounded(value / sum)) : keys.map(() => rounded(1 / keys.length));
  values[values.length - 1] = clamp01((values.at(-1) ?? 0) + rounded(1 - values.reduce((total, value) => total + value, 0)));
  return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? 0]));
}

interface NumericRange { green: [number, number]; yellowLow: number; yellowHigh: number }

function mixRange(a: NumericRange | undefined, b: NumericRange | undefined, rng: RandomNumberGenerator): NumericRange | undefined {
  const left = a ?? b;
  const right = b ?? a;
  if (!left || !right) return undefined;
  const green = [mix(left.green[0], right.green[0], rng, RANGE_VARIATION01), mix(left.green[1], right.green[1], rng, RANGE_VARIATION01)].sort((x, y) => x - y) as [number, number];
  if (green[0] === green[1]) green[1] = rounded(green[0] + MIN_RANGE_WIDTH);
  const lowDistance = Math.max(MIN_RANGE_WIDTH, ((left.green[0] - left.yellowLow) + (right.green[0] - right.yellowLow)) / 2);
  const highDistance = Math.max(MIN_RANGE_WIDTH, ((left.yellowHigh - left.green[1]) + (right.yellowHigh - right.green[1])) / 2);
  return { green, yellowLow: rounded(green[0] - lowDistance), yellowHigh: rounded(green[1] + highDistance) };
}

function mixEnvBands(seedParent: StrainBlueprint, pollenParent: StrainBlueprint, rng: RandomNumberGenerator): StrainBlueprint['envBands'] {
  const output: Record<string, Record<string, NumericRange>> = {};
  for (const phase of ['default', 'veg', 'flower'] as const) {
    const left = seedParent.envBands[phase];
    const right = pollenParent.envBands[phase];
    if (!left && !right) continue;
    const conditions: Record<string, NumericRange> = {};
    for (const key of [...new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])].sort()) {
      const range = mixRange(left?.[key as keyof typeof left] as NumericRange | undefined, right?.[key as keyof typeof right] as NumericRange | undefined, rng);
      if (range) conditions[key] = range;
    }
    output[phase] = conditions;
  }
  return output as StrainBlueprint['envBands'];
}

function makeCandidate(input: CrossF1Input, ordinal: number): F1Candidate {
  const id = deterministicUuid(input.worldSeed, `breeding:${input.runId}:candidate:${String(ordinal)}`);
  const rng = createRng(input.worldSeed, `breeding:${input.runId}:candidate:${String(ordinal)}:${input.seedParent.id}:${input.pollenParent.id}`);
  const clone = structuredClone(input.seedParent) as Record<string, unknown>;
  const phaseDurations = Object.fromEntries(Object.keys(input.seedParent.phaseDurations).sort().map((key) => [key, Math.max(1, Math.round(mix(input.seedParent.phaseDurations[key as keyof typeof input.seedParent.phaseDurations], input.pollenParent.phaseDurations[key as keyof typeof input.pollenParent.phaseDurations], rng, 0.04)))]));
  const blueprint = parseStrainBlueprint({
    ...clone,
    id,
    slug: `f1-${id.replaceAll('-', '').slice(0, 12)}`,
    class: 'strain',
    name: `${input.seedParent.name} × ${input.pollenParent.name} F1-${String(ordinal + 1)}`,
    lineage: { parents: [input.seedParent.id, input.pollenParent.id], roles: { seedParentId: input.seedParent.id, pollenParentId: input.pollenParent.id } },
    genotype: mixGenotype(input.seedParent.genotype, input.pollenParent.genotype, rng),
    chemotype: mixRecord(input.seedParent.chemotype, input.pollenParent.chemotype, rng, true),
    morphology: mixRecord(input.seedParent.morphology, input.pollenParent.morphology, rng, false),
    generalResilience: clamp01(mix(input.seedParent.generalResilience, input.pollenParent.generalResilience, rng)),
    germinationRate: clamp01(mix(input.seedParent.germinationRate, input.pollenParent.germinationRate, rng)),
    envBands: mixEnvBands(input.seedParent, input.pollenParent, rng),
    phaseDurations,
  });
  return { id: blueprint.id as F1Candidate['id'], ordinal, blueprint };
}

/** Produces a deterministic, runtime-schema-valid F1 population; parent order expresses seed and pollen roles. */
export function crossF1(input: CrossF1Input): readonly F1Candidate[] {
  if (input.seedParent.id === input.pollenParent.id) throw new Error('F1 parents must be different strains.');
  if (![3, 4, 5].includes(input.populationSize)) throw new RangeError('F1 populationSize must be 3, 4, or 5.');
  return Array.from({ length: input.populationSize }, (_, ordinal) => makeCandidate(input, ordinal));
}
