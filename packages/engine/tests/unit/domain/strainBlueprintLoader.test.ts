import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearStrainBlueprintCache,
  loadAllStrainBlueprints,
  loadStrainBlueprint
} from '@/backend/src/domain/blueprints/strainBlueprintLoader';
import type { StrainBlueprint } from '@/backend/src/domain/blueprints/strainBlueprint';
import type { Uuid } from '@/backend/src/domain/entities';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';
import {
  AK47_STRAIN_ID,
  WHITE_WIDOW_STRAIN_ID
} from '../../testUtils/strainFixtures.ts';

const blueprintsRoot = path.resolve(resolveBlueprintPath(''));

describe('strainBlueprintLoader', () => {
  beforeEach(() => {
    clearStrainBlueprintCache();
    vi.restoreAllMocks();
  });

  it('loadAllStrainBlueprints loads all strain blueprints', () => {
    const blueprints = loadAllStrainBlueprints({ blueprintsRoot });

    expect(blueprints.size).toBeGreaterThanOrEqual(5);
    const whiteWidow = blueprints.get(WHITE_WIDOW_STRAIN_ID);
    expect(whiteWidow).toBeDefined();
    expect(whiteWidow?.slug).toBe('white-widow');
    expect(whiteWidow?.class).toBe('strain');
  });

  it('loadStrainBlueprint retrieves a specific blueprint', () => {
    const blueprint = loadStrainBlueprint(WHITE_WIDOW_STRAIN_ID, { blueprintsRoot });

    expect(blueprint).not.toBeNull();
    expect(blueprint?.name).toBe('White Widow');
    expect(blueprint?.slug).toBe('white-widow');
    expect(blueprint?.growthModel).toBeDefined();
    expect(blueprint?.envBands).toBeDefined();
  });

  it('loadStrainBlueprint returns null for unknown id', () => {
    const unknownId = '99999999-9999-9999-9999-999999999999' as Uuid;
    const blueprint = loadStrainBlueprint(unknownId, { blueprintsRoot });

    expect(blueprint).toBeNull();
  });

  it('shares cache between loadAllStrainBlueprints calls', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');

    const first = loadAllStrainBlueprints({ blueprintsRoot });
    const initialReads = readSpy.mock.calls.length;
    const second = loadAllStrainBlueprints({ blueprintsRoot });

    expect(first.size).toBeGreaterThanOrEqual(5);
    expect(second.size).toBe(first.size);
    expect(readSpy.mock.calls.length).toBe(initialReads);
  });

  it('clears cache via clearStrainBlueprintCache', () => {
    loadAllStrainBlueprints({ blueprintsRoot });
    clearStrainBlueprintCache();

    const readSpy = vi.spyOn(fs, 'readFileSync');
    loadAllStrainBlueprints({ blueprintsRoot });

    expect(readSpy).toHaveBeenCalled();
  });

  it('throws when blueprints root is invalid', () => {
    expect(() => loadAllStrainBlueprints({ blueprintsRoot: '/invalid/path' })).toThrow();
  });

  it('loadStrainBlueprint caches individual lookups', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');

    const first = loadStrainBlueprint(AK47_STRAIN_ID, { blueprintsRoot });
    expect(first).not.toBeNull();
    const afterFirstReads = readSpy.mock.calls.length;

    const second = loadStrainBlueprint(AK47_STRAIN_ID, { blueprintsRoot });
    expect(second).toBe(first!);
    expect(readSpy.mock.calls.length).toBe(afterFirstReads);
  });
});
