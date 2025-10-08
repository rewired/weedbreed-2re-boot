import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertBlueprintClassMatchesPath, deriveBlueprintClassFromPath } from '@/backend/src/domain/blueprints/taxonomy.js';
import { resolveBlueprintPath } from '../../testUtils/paths.js';

const blueprintsRoot = path.resolve(resolveBlueprintPath(''));

function collectBlueprintFiles(root: string): readonly string[] {
  const stack = [root];
  const results: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

describe('blueprint taxonomy layout', () => {
  const blueprintFiles = collectBlueprintFiles(blueprintsRoot);

  it('keeps declared classes aligned with folder taxonomy', () => {
    for (const filePath of blueprintFiles) {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { class?: string };

      expect(payload.class, `${path.relative(blueprintsRoot, filePath)} missing class`).toBeTruthy();
      expect(() =>
        { assertBlueprintClassMatchesPath(payload.class!, filePath, { blueprintsRoot }); }
      ).not.toThrow();
    }
  });

  it('keeps blueprint directory depth within taxonomy v2 guardrails', () => {
    const failures: string[] = [];

    for (const filePath of blueprintFiles) {
      try {
        deriveBlueprintClassFromPath(filePath, { blueprintsRoot });
      } catch (error) {
        const relative = path.relative(blueprintsRoot, filePath);
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${relative}: ${message}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('keeps slug identifiers unique per blueprint class', () => {
    const registry = new Map<string, string>();
    const duplicates: string[] = [];

    for (const filePath of blueprintFiles) {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { class?: string; slug?: string };
      const blueprintClass = payload.class ?? '<missing>';
      const slug = payload.slug ?? '<missing>';
      const key = `${blueprintClass}:${slug}`;
      const relative = path.relative(blueprintsRoot, filePath);

      if (registry.has(key)) {
        duplicates.push(`${relative} conflicts with ${registry.get(key)}`);
      } else {
        registry.set(key, relative);
      }
    }

    expect(duplicates).toHaveLength(0);
  });
});
