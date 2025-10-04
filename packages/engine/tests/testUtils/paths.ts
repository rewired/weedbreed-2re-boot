import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function resolveBlueprintPath(rel: string): string {
  const candidate = fileURLToPath(new URL(`../../../data/blueprints/${rel}`, import.meta.url));

  if (existsSync(candidate)) {
    return candidate;
  }

  return fileURLToPath(new URL(`../../../../data/blueprints/${rel}`, import.meta.url));
}
