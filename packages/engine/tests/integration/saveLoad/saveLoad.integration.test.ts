import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { crossF1 } from '@/backend/src/breeding/crossF1';
import { resolveStrain } from '@/backend/src/domain/blueprints/strainResolver';
import type { SimulationWorld, Uuid } from '@/backend/src/domain/entities';
import { runTick } from '@/backend/src/engine/Engine';
import { postEconomyDebit } from '@/backend/src/economy/state';
import { createDemoScenario } from '@/backend/src/scenarios/demoScenario';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  createDefaultSaveGameMigrationRegistry,
  createSaveGame,
  hashSaveGameWorld,
  loadSaveGame,
  parseSaveGamePayload,
  serialiseSaveGame,
  UnsupportedSaveGameVersionError,
} from '@/backend/src/saveLoad/index';
import { deterministicUuid } from '@/backend/src/util/uuid';

const fixtureDir = fileURLToPath(new URL('../../fixtures/save/', import.meta.url));
const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7' as Uuid;
const SOUR_DIESEL_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2' as Uuid;

function resolveFixture(...segments: string[]): string { return path.join(fixtureDir, ...segments); }

async function writeTempSave(data: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'wb-save-load-'));
  const filePath = path.join(dir, 'save.json');
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
}

function id(seed: string, label: string): Uuid { return deterministicUuid(seed, label); }

function createRichWorld(): SimulationWorld {
  const seed = 'r800-roundtrip';
  const base = createDemoScenario({ companyName: 'Save Roundtrip', seed });
  const seedParent = resolveStrain(base, NORTHERN_LIGHTS_ID)!.blueprint;
  const pollenParent = resolveStrain(base, SOUR_DIESEL_ID)!.blueprint;
  const runId = id(seed, 'run');
  const candidates = crossF1({ worldSeed: seed, runId, seedParent, pollenParent, populationSize: 3 });
  const selected = { ...candidates[0]!.blueprint, name: 'Saved F1', slug: 'saved-f1' };
  const withBreeding: SimulationWorld = {
    ...base,
    simTimeHours: 120,
    breeding: {
      runs: [{
        id: runId,
        intentId: id(seed, 'cross-intent'),
        generation: 'F1',
        laboratoryRoomId: base.company.structures[0]!.rooms.find((room) => room.purpose === 'laboratory')!.id,
        status: 'selected',
        seedParentId: NORTHERN_LIGHTS_ID,
        pollenParentId: SOUR_DIESEL_ID,
        qualifyingLotIds: [id(seed, 'lot-a'), id(seed, 'lot-b')],
        populationSize: 3,
        candidates,
        selectedCandidateId: candidates[0]!.id,
        selectionIntentId: id(seed, 'select-intent'),
        createdAtSimTimeHours: 100,
      }],
      customStrainRegistry: [selected],
      qualifiedParents: [
        { strainId: NORTHERN_LIGHTS_ID, lotId: id(seed, 'lot-a'), harvestIntentId: id(seed, 'harvest-a'), quality01: 0.8, qualifiedAtSimTimeHours: 90 },
        { strainId: SOUR_DIESEL_ID, lotId: id(seed, 'lot-b'), harvestIntentId: id(seed, 'harvest-b'), quality01: 0.75, qualifiedAtSimTimeHours: 95 },
      ],
    },
  };
  const posting = postEconomyDebit(withBreeding, {
    intentId: id(seed, 'seed-cost'),
    category: 'seed',
    amountCc: 10,
    referenceId: base.company.structures[0]!.id,
    identity: 'r800-seed-cost',
    description: 'R800 ledger evidence',
    metadata: { strainId: NORTHERN_LIGHTS_ID, quantity: 2, unitPriceCc: 5 },
  });
  if (!posting.ok) throw new Error('R800 fixture posting failed.');
  return { ...withBreeding, economy: posting.economy };
}

describe('save/load integration v2', () => {
  it('round-trips the complete authoritative world with identical hash and continuation', async () => {
    const save = createSaveGame(createRichWorld());
    const parsed = await parseSaveGamePayload(JSON.parse(serialiseSaveGame(save)) as unknown);
    expect(parsed).toStrictEqual(save);
    expect(hashSaveGameWorld(parsed.world)).toBe(hashSaveGameWorld(save.world));
    expect(parsed.world.economy?.ledger).toStrictEqual(save.world.economy?.ledger);
    expect(parsed.world.breeding).toStrictEqual(save.world.breeding);

    const originalNext = runTick(save.world, {}).world;
    const loadedNext = runTick(parsed.world, {}).world;
    expect(hashSaveGameWorld(loadedNext)).toBe(hashSaveGameWorld(originalNext));
  });

  it('loads a current disk save without migration', async () => {
    const save = createSaveGame(createRichWorld());
    const filePath = await writeTempSave(save);
    const registry = createDefaultSaveGameMigrationRegistry();
    const spy = vi.spyOn(registry, 'migrate');
    expect(await loadSaveGame(filePath, { migrations: registry })).toStrictEqual(save);
    expect(spy).not.toHaveBeenCalled();
  });

  it('migrates both legacy fixtures to the same complete current world', async () => {
    const migratedV0 = await loadSaveGame(resolveFixture('v0', 'basic.json'));
    const migratedV1 = await loadSaveGame(resolveFixture('v1', 'basic.json'));
    expect(migratedV0).toStrictEqual(migratedV1);
    expect(migratedV0.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migratedV0.world.workforce).toBeDefined();
    expect(migratedV0.world.economy).toBeDefined();
    expect(migratedV0.world.breeding).toBeDefined();
  });

  it('rejects corrupt, future, and incomplete current payloads clearly', async () => {
    await expect(parseSaveGamePayload({ schemaVersion: 'banana' })).rejects.toThrow(/numeric schemaVersion/);
    await expect(parseSaveGamePayload({ schemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 })).rejects.toBeInstanceOf(UnsupportedSaveGameVersionError);
    const save = createSaveGame(createRichWorld());
    const company = { ...save.world.company } as Partial<typeof save.world.company>;
    delete company.structures;
    await expect(parseSaveGamePayload({ ...save, world: { ...save.world, company } })).rejects.toThrow(/structures/);
  });
});
