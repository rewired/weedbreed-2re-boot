import { CURRENT_SAVE_SCHEMA_VERSION } from '../constants.ts';

import { SaveGameMigrationRegistry } from './registry.ts';
import { migrateV0ToV1 } from './v0ToV1.ts';

export function createDefaultSaveGameMigrationRegistry(): SaveGameMigrationRegistry {
  const registry = new SaveGameMigrationRegistry(CURRENT_SAVE_SCHEMA_VERSION);
  registry.register(migrateV0ToV1);
  return registry;
}

export type { SaveGameMigrationRegistry, SaveGameMigrationStep } from './registry.ts';
