export { CURRENT_SAVE_SCHEMA_VERSION, SAVEGAME_REPOSITORY_RELATIVE_PATH } from './constants.ts';
export { createDefaultSaveGameMigrationRegistry } from './migrations/index.ts';
export type { SaveGameMigrationRegistry, SaveGameMigrationStep } from './migrations/index.ts';
export {
  createSaveGame,
  hashSaveGameWorld,
  loadSaveGame,
  parseSaveGamePayload,
  serialiseSaveGame,
  UnsupportedSaveGameVersionError,
  writeSaveGame,
} from './saveManager.ts';
export type { SaveGame } from './saveManager.ts';
export { saveGameSchema, legacySaveGameSchemaV0, legacySaveGameSchemaV1, saveGameEnvelopeSchema } from './schemas.ts';
export {
  canonicaliseStateHashNumber,
  canonicaliseStateHashValue,
  canonicalStringifyStateHash,
  hashCanonicalState,
  STATE_HASH_DECIMAL_PLACES,
  STATE_HASH_NUMERIC_TOLERANCES,
} from '../util/canonicalStateHash.ts';
