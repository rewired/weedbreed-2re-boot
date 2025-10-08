import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertBlueprintClassMatchesPath,
  BlueprintPathError,
  BlueprintTaxonomyMismatchError,
  deriveBlueprintClassFromPath
} from '@/backend/src/domain/blueprints/taxonomy';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';

const blueprintsRoot = path.resolve(resolveBlueprintPath(''));

describe('blueprint taxonomy guards', () => {
  it('derives taxonomy metadata for top-level domain blueprints', () => {
    const filePath = resolveBlueprintPath('strain/white-widow.json');

    const derived = deriveBlueprintClassFromPath(filePath, { blueprintsRoot });

    expect(derived).toMatchObject({
      expectedClass: 'strain',
      allowNamespaceSuffix: false,
      relativePath: 'strain/white-widow.json'
    });
  });

  it('derives taxonomy metadata for nested device blueprints', () => {
    const filePath = resolveBlueprintPath('device/climate/cool-air-split-3000.json');

    const derived = deriveBlueprintClassFromPath(filePath, { blueprintsRoot });

    expect(derived).toMatchObject({
      expectedClass: 'device.climate',
      allowNamespaceSuffix: false,
      relativePath: 'device/climate/cool-air-split-3000.json'
    });
  });

  it('allows namespace suffixes for room blueprints', () => {
    const filePath = resolveBlueprintPath('room/purpose/growroom.json');

    const derived = deriveBlueprintClassFromPath(filePath, { blueprintsRoot });

    expect(derived).toMatchObject({
      expectedClass: 'room.purpose',
      allowNamespaceSuffix: true,
      relativePath: 'room/purpose/growroom.json'
    });
  });

  it('rejects directory depth beyond two levels', () => {
    const filePath = path.join(blueprintsRoot, 'device/climate/nested/invalid.json');

    expect(() => deriveBlueprintClassFromPath(filePath, { blueprintsRoot })).toThrow(BlueprintPathError);
  });

  it('throws BlueprintTaxonomyMismatchError when declared class diverges from taxonomy', () => {
    const filePath = resolveBlueprintPath('device/climate/cool-air-split-3000.json');

    expect(() =>
      { assertBlueprintClassMatchesPath('device.lighting', filePath, { blueprintsRoot }); }
    ).toThrow(BlueprintTaxonomyMismatchError);
  });
});
