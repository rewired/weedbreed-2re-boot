import { describe, expect, it } from 'vitest';

import { createDemoScenario } from '@/backend/src/scenarios/demoScenario';
import { createSaveGame } from '@/backend/src/saveLoad/saveManager';
import { saveGameSchema } from '@/backend/src/saveLoad/schemas';

describe('saveGameSchema v2', () => {
  it('accepts a complete authoritative world', () => {
    const world = createDemoScenario({ companyName: 'Save Schema', seed: 'seed-123' });
    const payload = createSaveGame(world, {
      createdAtIso: '2025-01-01T00:00:00.000Z',
      description: 'demo save',
    });
    expect(saveGameSchema.parse(payload)).toStrictEqual(payload);
  });

  it('rejects payloads without simTime', () => {
    const save = createSaveGame(createDemoScenario({ companyName: 'Save Schema', seed: 'missing-time' }));
    const invalid = { ...save } as Partial<typeof save>;
    delete invalid.simTime;
    expect(() => saveGameSchema.parse(invalid)).toThrowError(/simTime/);
  });

  it('validates breeding state and rejects derived read models', () => {
    const save = createSaveGame(createDemoScenario({ companyName: 'Save Schema', seed: 'breeding-save' }));
    expect(save.world.breeding).toEqual({ runs: [], customStrainRegistry: [], qualifiedParents: [] });
    expect(() => saveGameSchema.parse({
      ...save,
      world: { ...save.world, readModels: { derived: true } },
    })).toThrowError(/Unrecognized key/);
  });

  it('rejects malformed breeding state and mismatched envelope state', () => {
    const save = createSaveGame(createDemoScenario({ companyName: 'Save Schema', seed: 'invalid-breeding' }));
    expect(() => saveGameSchema.parse({
      ...save,
      world: { ...save.world, breeding: { ...save.world.breeding, runs: 'invalid' } },
    })).toThrowError(/runs/);
    expect(() => saveGameSchema.parse({ ...save, seed: 'other-seed' })).toThrowError(/Save seed/);
    expect(() => saveGameSchema.parse({ ...save, simTime: { tick: 0, hoursElapsed: 1 } })).toThrowError(/Save time/);
  });
});
