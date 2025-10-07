import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseStrainBlueprint, type StrainBlueprint } from './strainBlueprint.js';
import type { Uuid } from '../entities.js';

export interface LoadStrainBlueprintOptions {
  readonly blueprintsRoot?: string;
  readonly strict?: boolean;
}

const DEFAULT_BLUEPRINTS_ROOT = path.resolve(
  fileURLToPath(new URL('../../../../../../../', import.meta.url)),
  'data/blueprints'
);

let blueprintCache: Map<Uuid, StrainBlueprint> | null = null;

function resolveBlueprintsRoot(root?: string): string {
  if (!root) {
    return DEFAULT_BLUEPRINTS_ROOT;
  }

  return path.isAbsolute(root) ? path.normalize(root) : path.resolve(root);
}

function collectStrainBlueprintFiles(blueprintsRoot: string): string[] {
  const strainRoot = path.join(blueprintsRoot, 'strain');

  if (!fs.existsSync(strainRoot)) {
    throw new Error(`Strain blueprints root "${strainRoot}" does not exist.`);
  }

  const entries = fs.readdirSync(strainRoot, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(strainRoot, entry.name);

    if (entry.isDirectory()) {
      throw new Error(
        `Strain blueprints path "${entryPath}" should not contain nested directories after taxonomy v2 migration.`
      );
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function buildStrainBlueprintIndex(options: LoadStrainBlueprintOptions = {}): Map<Uuid, StrainBlueprint> {
  const blueprintsRoot = resolveBlueprintsRoot(options.blueprintsRoot);
  const files = collectStrainBlueprintFiles(blueprintsRoot);
  const slugRegistry = new Map<string, string>();
  const index = new Map<Uuid, StrainBlueprint>();

  for (const filePath of files) {
    let blueprint: StrainBlueprint | null = null;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const payload = JSON.parse(raw);
      blueprint = parseStrainBlueprint(payload, {
        filePath,
        blueprintsRoot,
        slugRegistry
      });
    } catch (error) {
      if (options.strict) {
        throw error;
      }

      // eslint-disable-next-line no-console
      console.warn(`Failed to load strain blueprint from "${filePath}":`, error);
    }

    if (!blueprint) {
      continue;
    }

    index.set(blueprint.id as Uuid, blueprint);
  }

  return index;
}

export function loadAllStrainBlueprints(
  options: LoadStrainBlueprintOptions = {}
): Map<Uuid, StrainBlueprint> {
  if (!blueprintCache) {
    blueprintCache = buildStrainBlueprintIndex(options);
  }

  return new Map(blueprintCache);
}

export function loadStrainBlueprint(
  strainId: Uuid,
  options: LoadStrainBlueprintOptions = {}
): StrainBlueprint | null {
  if (!blueprintCache) {
    blueprintCache = buildStrainBlueprintIndex(options);
  }

  return blueprintCache.get(strainId) ?? null;
}

export function clearStrainBlueprintCache(): void {
  blueprintCache = null;
}

