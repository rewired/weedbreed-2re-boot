import {
  BlueprintTaxonomyMismatchError,
  deriveBlueprintClassFromPath
} from '../taxonomy.ts';
import type { BlueprintPathOptions } from '../taxonomy.ts';

export interface DeviceTaxonomyGuardOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export interface DeviceTaxonomyGuardResult {
  readonly relativePath?: string;
}

export function guardDeviceBlueprintTaxonomy(
  blueprintClass: string,
  options: DeviceTaxonomyGuardOptions = {}
): DeviceTaxonomyGuardResult {
  if (!options.filePath) {
    return {};
  }

  const derived = deriveBlueprintClassFromPath(options.filePath, options);
  const expected = derived.expectedClass;

  if (derived.allowNamespaceSuffix) {
    if (blueprintClass !== expected && !blueprintClass.startsWith(`${expected}.`)) {
      throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, blueprintClass);
    }
  } else if (blueprintClass !== expected) {
    throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, blueprintClass);
  }

  return { relativePath: derived.relativePath } satisfies DeviceTaxonomyGuardResult;
}
