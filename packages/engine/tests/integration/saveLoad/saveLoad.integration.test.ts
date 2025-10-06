import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { hashCanonicalJson } from '../../../../../src/shared/determinism/hash.js';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  createDefaultSaveGameMigrationRegistry,
  loadSaveGame,
} from '@/backend/src/saveLoad/index.js';

const fixtureDir = fileURLToPath(new URL('../../fixtures/save/', import.meta.url));

function resolveFixture(...segments: string[]): string {
  return path.join(fixtureDir, ...segments);
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
});
