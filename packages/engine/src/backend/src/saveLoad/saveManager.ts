import fs from 'node:fs/promises';
import path from 'node:path';

import safeStringify from 'safe-stable-stringify';

import { CURRENT_SAVE_SCHEMA_VERSION } from './constants.ts';
import { saveGameEnvelopeSchema, saveGameSchema, type SaveGame } from './schemas.ts';
import { type SaveGameMigrationRegistry } from './migrations/index.ts';
import { validateCompanyWorld } from '../domain/validation.ts';
import type { Company } from '../domain/entities.ts';

/**
 * Optional configuration for {@link loadSaveGame}.
 */
export interface LoadSaveGameOptions {
  readonly migrations?: SaveGameMigrationRegistry;
  readonly targetVersion?: number;
}

/**
 * Optional configuration for {@link writeSaveGame}.
 */
export interface WriteSaveGameOptions {
  readonly ensureDir?: boolean;
}

function serialiseSaveGame(payload: SaveGame): string {
  const canonical = safeStringify(payload, undefined, 2);

  if (canonical === undefined) {
    throw new Error('Unable to serialise save payload');
  }

  return `${canonical}\n`;
}

async function readSaveFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, 'utf8');

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Save file at "${filePath}" is not valid JSON`, { cause: error });
  }
}

function assertWorldIntegrity(save: SaveGame): void {
  const world = (save as { world?: unknown }).world;

  if (!world || typeof world !== 'object') {
    throw new Error('Save file payload is missing the world branch');
  }

  const company = (world as { company?: unknown }).company;

  if (!company || typeof company !== 'object') {
    throw new Error('Save file world is missing the company branch');
  }

  const validation = validateCompanyWorld(company as Company);

  if (!validation.ok) {
    const description = validation.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ');

    throw new Error(`Save file world violates SEC guardrails: ${description}`);
  }
}

/**
 * Load and validate a savegame from disk, applying schema migrations when
 * required.
 *
 * @param filePath Absolute path to the JSON save file.
 * @param options Optional loader configuration (migration registry / override target version).
 * @returns A {@link SaveGame} aligned to {@link CURRENT_SAVE_SCHEMA_VERSION}.
 */
export async function loadSaveGame(filePath: string, options: LoadSaveGameOptions = {}): Promise<SaveGame> {
  const payload = await readSaveFile(filePath);
  const envelope = saveGameEnvelopeSchema.parse(payload);
  const targetVersion = options.targetVersion ?? CURRENT_SAVE_SCHEMA_VERSION;

  if (envelope.schemaVersion > targetVersion) {
    throw new Error(`Save file schemaVersion ${envelope.schemaVersion} exceeds supported version ${targetVersion}`);
  }

  if (envelope.schemaVersion === targetVersion) {
    const parsed = saveGameSchema.parse(payload);
    assertWorldIntegrity(parsed);
    return parsed;
  }

  if (!options.migrations) {
    throw new Error('No migration registry provided for legacy save file');
  }

  const migrated = await options.migrations.migrate(payload, targetVersion);

  const parsedMigrated = saveGameSchema.parse(migrated);
  assertWorldIntegrity(parsedMigrated);
  return parsedMigrated;
}

/**
 * Persist a savegame to disk using an atomic write (temp file → fsync → rename)
 * so partially written files are never observed.
 *
 * @param filePath Absolute path to write to.
 * @param payload Savegame payload that will be validated before serialisation.
 * @param options Optional write configuration (e.g., ensure parent directory).
 */
export async function writeSaveGame(
  filePath: string,
  payload: SaveGame,
  options: WriteSaveGameOptions = {},
): Promise<void> {
  const serialised = serialiseSaveGame(saveGameSchema.parse(payload));
  const directory = path.dirname(filePath);

  if (options.ensureDir) {
    await fs.mkdir(directory, { recursive: true });
  }

  const tempPath = `${filePath}.tmp`;
  await fs.rm(tempPath, { force: true });

  const handle = await fs.open(tempPath, 'w');

  try {
    await handle.writeFile(serialised, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

export type { SaveGame } from './schemas.ts';
