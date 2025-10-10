import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertBlueprintClassMatchesPath, deriveBlueprintClassFromPath } from '@/backend/src/domain/blueprints/taxonomy';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';
import { asObject, expectDefined, hasKey } from '../../util/expectors';

const blueprintsRoot = path.resolve(resolveBlueprintPath(''));

function collectBlueprintFiles(root: string): readonly string[] {
  const stack = [root];
  const results: string[] = [];

  while (stack.length > 0) {
    const current = expectDefined(stack.pop());
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
      const payload = expectDefined(asObject(JSON.parse(fs.readFileSync(filePath, 'utf8'))));
      const relativePath = path.relative(blueprintsRoot, filePath);

      expect(hasKey(payload, 'class'), `${relativePath} missing class`).toBe(true);

      const blueprintClass = payload.class;
      expect(typeof blueprintClass).toBe('string');

      if (typeof blueprintClass !== 'string') {
        continue;
      }

      expect(() =>
        { assertBlueprintClassMatchesPath(blueprintClass, filePath, { blueprintsRoot }); }
      ).not.toThrow();
    }
  });

  it('keeps blueprint directory depth within taxonomy v2 guardrails', () => {
    const failures: string[] = [];

    for (const filePath of blueprintFiles) {
      try {
        deriveBlueprintClassFromPath(filePath, { blueprintsRoot });
      } catch (error: unknown) {
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
      const payload = expectDefined(asObject(JSON.parse(fs.readFileSync(filePath, 'utf8'))));
      const blueprintClass =
        hasKey(payload, 'class') && typeof payload.class === 'string' ? payload.class : '<missing>';
      const slug = hasKey(payload, 'slug') && typeof payload.slug === 'string' ? payload.slug : '<missing>';
      const key = `${blueprintClass}:${slug}`;
      const relative = path.relative(blueprintsRoot, filePath);

      if (registry.has(key)) {
        const conflict = registry.get(key) ?? '<untracked>';
        duplicates.push(`${relative} conflicts with ${conflict}`);
      } else {
        registry.set(key, relative);
      }
    }

    expect(duplicates).toHaveLength(0);
  });
});
