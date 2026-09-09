/* eslint-disable wb-sim/no-ts-import-js-extension */

import { assessZoneSowReadiness, type SimulationWorld } from '@wb/engine';
import { z } from 'zod';

export const JOURNEY_MILESTONE_CODES = [
  'game-started', 'facility-ready', 'parents-sown', 'incident-resolved',
  'parents-harvested', 'sale-completed', 'f1-generated', 'f1-selected', 'f1-harvested',
] as const;

const milestoneSchema = z.object({
  code: z.enum(JOURNEY_MILESTONE_CODES),
  achievedAtSimTimeHours: z.number().finite().nonnegative(),
  evidenceId: z.string().min(1),
}).strict();

export const journeyProgressSchema = z.object({
  milestones: z.array(milestoneSchema).max(JOURNEY_MILESTONE_CODES.length).superRefine((items, context) => {
    const seen = new Set<string>();
    let priorIndex = -1;
    let priorTime = -1;
    items.forEach((item, index) => {
      if (seen.has(item.code)) context.addIssue({
        code: z.ZodIssueCode.custom, path: [index, 'code'], message: 'Journey milestone codes must be unique.',
      });
      seen.add(item.code);
      const canonicalIndex = JOURNEY_MILESTONE_CODES.indexOf(item.code);
      if (canonicalIndex !== index || canonicalIndex <= priorIndex || item.achievedAtSimTimeHours < priorTime) context.addIssue({
        code: z.ZodIssueCode.custom, path: [index], message: 'Journey milestones must form the canonical chronological prefix.',
      });
      priorIndex = canonicalIndex;
      priorTime = item.achievedAtSimTimeHours;
    });
  }),
}).strict();

export type JourneyProgress = z.infer<typeof journeyProgressSchema>;
export type JourneyMilestoneCode = (typeof JOURNEY_MILESTONE_CODES)[number];

const CANONICAL_PARENT_STRAIN_IDS = [
  '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7',
  '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2',
] as const;

export function createJourneyProgress(): JourneyProgress { return { milestones: [] }; }

function evidence(world: SimulationWorld): Partial<Record<JourneyMilestoneCode, string>> {
  const rooms = world.company.structures.flatMap((structure) => structure.rooms);
  const zones = rooms.flatMap((room) => room.zones);
  const plants = zones.flatMap((zone) => zone.plants);
  const qualified = new Set<string>((world.breeding?.qualifiedParents ?? []).map((item) => item.strainId));
  const run = [...(world.breeding?.runs ?? [])]
    .sort((a, b) => a.createdAtSimTimeHours - b.createdAtSimTimeHours || a.id.localeCompare(b.id)).at(0);
  const selectedId = run?.selectedCandidateId;
  const f1Harvest = selectedId ? plants.find((plant) =>
    plant.strainId === selectedId && plant.status === 'harvested'
  ) : undefined;
  const parentPlants = plants.filter((plant) =>
    CANONICAL_PARENT_STRAIN_IDS.includes(plant.strainId as typeof CANONICAL_PARENT_STRAIN_IDS[number])
  );
  const parentStrainIds = run
    ? [run.seedParentId, run.pollenParentId].sort()
    : [...CANONICAL_PARENT_STRAIN_IDS].sort();
  const qualifiedParentEvidence = parentStrainIds.every((strainId) => qualified.has(strainId))
    ? parentStrainIds.join(',')
    : undefined;
  const resolvedIncident = world.demoIncident?.status === 'resolved'
    ? `incident:${world.demoIncident.zoneId}:${String(world.demoIncident.triggeredAtSimTimeHours)}`
    : undefined;
  return {
    'game-started': world.id,
    ...(zones.some((zone) => assessZoneSowReadiness(zone).ready) ? { 'facility-ready': zones.find((zone) => assessZoneSowReadiness(zone).ready)!.id } : {}),
    ...(new Set(parentPlants.map((plant) => plant.strainId)).size >= 2 ? { 'parents-sown': parentPlants.map((plant) => plant.id).sort().join(',') } : {}),
    ...(resolvedIncident ? { 'incident-resolved': resolvedIncident } : {}),
    ...(qualifiedParentEvidence ? { 'parents-harvested': qualifiedParentEvidence } : {}),
    ...((world.economy?.ledger ?? []).find((item) => item.category === 'sale') ? { 'sale-completed': world.economy!.ledger.find((item) => item.category === 'sale')!.id } : {}),
    ...(run ? { 'f1-generated': run.id } : {}),
    ...(selectedId ? { 'f1-selected': selectedId } : {}),
    ...(f1Harvest ? { 'f1-harvested': f1Harvest.id } : {}),
  };
}

/** Appends newly proven milestones without rewriting their original achievement evidence. */
export function reconcileJourneyProgress(previous: JourneyProgress, world: SimulationWorld): JourneyProgress {
  const proven = evidence(world);
  const seen = new Set(previous.milestones.map((item) => item.code));
  const additions: JourneyProgress['milestones'][number][] = [];
  for (const code of JOURNEY_MILESTONE_CODES) {
    if (seen.has(code)) continue;
    const evidenceId = proven[code];
    if (!evidenceId) break;
    additions.push({ code, achievedAtSimTimeHours: world.simTimeHours, evidenceId });
  }
  return journeyProgressSchema.parse({ milestones: [...previous.milestones, ...additions] });
}

/** Validates imported milestone evidence against the save's time boundary. */
export function validateJourneyProgressForWorld(input: unknown, world: SimulationWorld): JourneyProgress {
  const progress = journeyProgressSchema.parse(input);
  if (progress.milestones.some((item) => item.achievedAtSimTimeHours > world.simTimeHours)) {
    throw new Error('Journey milestone evidence cannot occur after the saved simulation time.');
  }
  const proven = evidence(world);
  const mismatch = progress.milestones.find((item) => proven[item.code] !== item.evidenceId);
  if (mismatch) {
    throw new Error(
      `Journey milestone ${mismatch.code} evidence does not match the imported engine world `
      + `(saved=${mismatch.evidenceId}, proven=${proven[mismatch.code] ?? 'missing'}).`,
    );
  }
  return progress;
}
