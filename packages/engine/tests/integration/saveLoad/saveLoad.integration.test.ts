import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { hashCanonicalJson } from '@/shared/determinism/hash';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  createDefaultSaveGameMigrationRegistry,
  loadSaveGame
} from '@/backend/src/saveLoad/index';

const fixtureDir = fileURLToPath(new URL('../../fixtures/save/', import.meta.url));

function resolveFixture(...segments: string[]): string {
  return path.join(fixtureDir, ...segments);
}

async function writeTempSave(data: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'wb-save-load-'));
  const filePath = path.join(dir, 'save.json');
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
}

describe('save/load integration', () => {
  it('loads the current schema fixture without migration', async () => {
    const filePath = resolveFixture('v1', 'basic.json');
    const save = await loadSaveGame(filePath);

    expect(save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);

    const expected = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    await expect(hashCanonicalJson(save)).resolves.toBe(await hashCanonicalJson(expected));
  });

  it('migrates a legacy save fixture to the current schema', async () => {
    const legacyPath = resolveFixture('v0', 'basic.json');
    const currentPath = resolveFixture('v1', 'basic.json');
    const registry = createDefaultSaveGameMigrationRegistry();

    const migrated = await loadSaveGame(legacyPath, { migrations: registry });
    const current = await loadSaveGame(currentPath, { migrations: registry });

    expect(migrated).toEqual(current);
    await expect(hashCanonicalJson(migrated)).resolves.toBe(await hashCanonicalJson(current));
  });

  it('rejects a save file with a corrupt schemaVersion header', async () => {
    const filePath = await writeTempSave({ schemaVersion: 'banana' });

    await expect(loadSaveGame(filePath)).rejects.toThrow(/schemaVersion/);
  });

  it('rejects saves missing company.structures', async () => {
    const baseline = JSON.parse(await fs.readFile(resolveFixture('v1', 'basic.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    const world = baseline.world as Record<string, unknown>;
    const company = (world.company as Record<string, unknown>) ?? {};
    delete company.structures;
    world.company = company;

    const filePath = await writeTempSave(baseline);

    await expect(loadSaveGame(filePath)).rejects.toThrow(/company\.structures/);
  });

  it('does not invoke migrations when loading a current schema save', async () => {
    const filePath = resolveFixture('v1', 'basic.json');
    const registry = createDefaultSaveGameMigrationRegistry();
    const spy = vi.spyOn(registry, 'migrate');

    const save = await loadSaveGame(filePath, { migrations: registry });

    expect(save.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(spy).not.toHaveBeenCalled();
  });
});
