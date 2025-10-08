import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeSaveGame } from '@/backend/src/saveLoad/saveManager';
import type { SaveGame } from '@/backend/src/saveLoad/saveManager';

const BASE_PAYLOAD: SaveGame = {
  schemaVersion: 1,
  seed: 'unit-test',
  simTime: {
    tick: 1,
    hoursElapsed: 1,
  },
  world: { demo: true },
};

describe('writeSaveGame', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-save-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes canonical JSON with trailing newline', async () => {
    const target = path.join(tmpDir, 'save.json');

    await writeSaveGame(target, BASE_PAYLOAD, { ensureDir: true });

    const contents = await fs.readFile(target, 'utf8');
    expect(contents.endsWith('\n')).toBe(true);
    expect(JSON.parse(contents)).toEqual(BASE_PAYLOAD);
  });

  it('leaves the original file untouched when rename fails', async () => {
    const target = path.join(tmpDir, 'existing.json');
    await fs.writeFile(target, '{"note":"original"}', 'utf8');

    const renameSpy = vi
      .spyOn(fs, 'rename')
      .mockRejectedValueOnce(new Error('rename failed'));

    await expect(writeSaveGame(target, BASE_PAYLOAD)).rejects.toThrow('rename failed');

    const contents = await fs.readFile(target, 'utf8');
    expect(contents).toBe('{"note":"original"}');
    expect(renameSpy).toHaveBeenCalled();

    await expect(fs.stat(`${target}.tmp`)).rejects.toThrow();
  });
});
