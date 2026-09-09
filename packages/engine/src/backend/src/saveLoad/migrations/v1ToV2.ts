import { createDemoScenario } from '../../scenarios/demoScenario.ts';
import { parseSimulationWorld } from '../../domain/schemas/simulationWorld.ts';
import { legacySaveGameSchemaV1, saveGameSchema, type SaveGame } from '../schemas.ts';
import type { SaveGameMigrationStep } from './registry.ts';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Migrates the loose prototype v1 world into the complete deterministic v2 world contract. */
export const migrateV1ToV2: SaveGameMigrationStep = {
  fromVersion: 1,
  toVersion: 2,
  migrate(input) {
    const parsed = legacySaveGameSchemaV1.parse(input);
    const rawWorld = record(parsed.world);
    const rawCompany = record(rawWorld.company);
    const companyName = typeof rawCompany.name === 'string' && rawCompany.name.trim().length > 0
      ? rawCompany.name
      : 'Migrated Company';
    const baseline = createDemoScenario({ companyName, seed: parsed.seed });
    const completeCandidate = {
      ...baseline,
      ...rawWorld,
      seed: parsed.seed,
      simTimeHours: parsed.simTime.hoursElapsed,
      company: { ...baseline.company, ...rawCompany },
      workforce: rawWorld.workforce ?? baseline.workforce,
      economy: rawWorld.economy ?? baseline.economy,
      breeding: rawWorld.breeding ?? baseline.breeding,
    };
    const migrated: SaveGame = {
      schemaVersion: 2,
      seed: parsed.seed,
      simTime: parsed.simTime,
      world: parseSimulationWorld(completeCandidate),
      metadata: parsed.metadata,
    };
    return Promise.resolve(saveGameSchema.parse(migrated));
  },
};
