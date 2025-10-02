import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertBlueprintClassMatchesPath } from '@/backend/src/domain/blueprints/taxonomy.js';

const blueprintsRoot = path.resolve(
  fileURLToPath(new URL('../../../../../data/blueprints/', import.meta.url))
);

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
        assertBlueprintClassMatchesPath(payload.class as string, filePath, { blueprintsRoot })
      ).not.toThrow();
    }
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
