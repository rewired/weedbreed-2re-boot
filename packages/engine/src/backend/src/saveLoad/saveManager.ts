import fs from 'node:fs/promises';
import path from 'node:path';
import safeStringify from 'safe-stable-stringify';

import { CURRENT_SAVE_SCHEMA_VERSION } from './constants.ts';
import { saveGameEnvelopeSchema, saveGameSchema, type SaveGame } from './schemas.ts';
import { createDefaultSaveGameMigrationRegistry, type SaveGameMigrationRegistry } from './migrations/index.ts';
import { validateCompanyWorld } from '../domain/validation.ts';
import type { Company } from '../domain/entities.ts';
import { fmtNum } from '../util/format.ts';
import { normaliseUnknownError } from '../util/error.ts';
import { economyStateSchema } from '../economy/state.ts';
import { breedingStateSchema } from '../breeding/schema.ts';
import { parseSimulationWorld } from '../domain/schemas/simulationWorld.ts';
import type { SimulationWorld } from '../domain/entities.ts';
import { hashCanonicalState } from '../util/canonicalStateHash.ts';

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

/** Stable JSON serialization used by disk export and browser downloads. */
export function serialiseSaveGame(payload: SaveGame): string {
  const validated = saveGameSchema.parse(payload);
  assertWorldIntegrity(validated);
  const candidate = safeStringify(validated, undefined, 2) as unknown;

  if (typeof candidate !== 'string') {
    throw new Error('Unable to serialise save payload');
  }

  return `${candidate}\n`;
}

/** Stable error raised when a save targets an unsupported future schema. */
export class UnsupportedSaveGameVersionError extends Error {
  public readonly code = 'unsupported_save_version' as const;
}

/** Builds a validated current-version save document from an authoritative engine world. */
export function createSaveGame(
  world: SimulationWorld,
  metadata?: SaveGame['metadata'],
): SaveGame {
  const parsedWorld = parseSimulationWorld(world);
  const save = saveGameSchema.parse({
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    seed: parsedWorld.seed,
    simTime: {
      tick: Math.trunc(parsedWorld.simTimeHours),
      hoursElapsed: parsedWorld.simTimeHours,
    },
    world: parsedWorld,
    ...(metadata ? { metadata } : {}),
  });
  assertWorldIntegrity(save);
  return save;
}

/** Computes a canonical SHA-256 identity for a fully validated world snapshot. */
export function hashSaveGameWorld(world: SimulationWorld): string {
  return hashCanonicalState(parseSimulationWorld(world));
}

async function readSaveFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, 'utf8');

  try {
    return JSON.parse(raw) as unknown;
  } catch (error: unknown) {
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

  const economy = (world as { economy?: unknown }).economy;
  if (economy !== undefined) {
    const economyValidation = economyStateSchema.safeParse(economy);
    if (!economyValidation.success) {
      throw new Error('Save file world contains invalid economy state.');
    }
  }
  const breeding = (world as { breeding?: unknown }).breeding;
  if (breeding !== undefined && !breedingStateSchema.safeParse(breeding).success) {
    throw new Error('Save file world contains invalid breeding state.');
  }
}

/** Parses an in-memory save payload and applies the registered legacy migrations. */
export async function parseSaveGamePayload(
  payload: unknown,
  options: LoadSaveGameOptions = {},
): Promise<SaveGame> {
  const envelopeResult = saveGameEnvelopeSchema.safeParse(payload);
  if (!envelopeResult.success) {
    throw new Error('Save game payload is missing a valid numeric schemaVersion.');
  }
  const envelope = envelopeResult.data;
  const targetVersion = options.targetVersion ?? CURRENT_SAVE_SCHEMA_VERSION;
  if (envelope.schemaVersion > targetVersion) {
    throw new UnsupportedSaveGameVersionError(
      `Save file schemaVersion ${fmtNum(envelope.schemaVersion)} exceeds supported version ${fmtNum(targetVersion)}`,
    );
  }
  const candidate = envelope.schemaVersion === targetVersion
    ? payload
    : await (options.migrations ?? createDefaultSaveGameMigrationRegistry()).migrate(payload, targetVersion);
  const parsed = saveGameSchema.parse(candidate);
  assertWorldIntegrity(parsed);
  return parsed;
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
  return parseSaveGamePayload(payload, options);
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
  const serialised = serialiseSaveGame(payload);
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
  } catch (error: unknown) {
    await fs.rm(tempPath, { force: true });
    throw normaliseUnknownError(error, 'Failed to finalise save file write');
  }
}

export type { SaveGame } from './schemas.ts';
