import { legacySaveGameSchemaV0, saveGameSchema, type SaveGame } from '../schemas.ts';

import type { SaveGameMigrationStep } from './registry.ts';

export const migrateV0ToV1: SaveGameMigrationStep = {
  fromVersion: 0,
  toVersion: 1,
  migrate(input) {
    const parsed = legacySaveGameSchemaV0.parse(input);

    const migrated: SaveGame = {
      schemaVersion: 1,
      seed: parsed.seed,
      simTime: {
        tick: parsed.ticksElapsed,
        hoursElapsed: parsed.hoursElapsed,
      },
      world: parsed.world,
      metadata: parsed.createdAt
        ? {
            createdAtIso: parsed.createdAt,
          }
        : undefined,
    };

    return Promise.resolve(saveGameSchema.parse(migrated));
  },
};
