import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATES,
  generatePackageAudit,
  renderPackageAuditMarkdown
} from '../src/lib/packageAudit.js';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');

describe('package audit reporting', () => {
  it('reports installed metadata for known candidates', async () => {
    const { entries } = await generatePackageAudit();
    const names = entries.map((entry) => entry.candidate.name);

    expect(names).toEqual(CANDIDATES.map((candidate) => candidate.name));

    const globbyEntry = entries.find((entry) => entry.candidate.name === 'globby');
    expect(globbyEntry?.installed).toBe(true);
    expect(globbyEntry?.directUsages.some((usage) => usage.includes('packages/tools/src/lib/packageAudit.ts'))).toBe(true);

    const psychrolibEntry = entries.find((entry) => entry.candidate.name === 'psychrolib');
    expect(psychrolibEntry?.installed).toBe(false);
    expect(psychrolibEntry?.versions).toEqual(['—']);
    expect(psychrolibEntry?.notes.some((note) => note.includes('v2 upstream release'))).toBe(true);
  });

  it('keeps the committed markdown report in sync with the generator', async () => {
    const { entries } = await generatePackageAudit();
    const markdown = renderPackageAuditMarkdown({ entries }).trim();
    const docPath = path.join(REPO_ROOT, 'docs/reports/PACKAGE_AUDIT.md');
    const doc = (await readFile(docPath, 'utf8')).trim();

    expect(markdown).toBe(doc);
  });
});
