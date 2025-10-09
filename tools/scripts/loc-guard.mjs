#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const WARN_THRESHOLD = 700;
const FAIL_THRESHOLD = 1200;

const INCLUDE_GLOBS = [
  'packages/**/src/**/*.{ts,tsx,js,jsx,mjs,mts,cjs,cts}'
];

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.turbo/**',
  '**/.cache/**'
];

const toRelative = (filePath) => path.relative(process.cwd(), filePath);

const countLoc = (source) => {
  if (source.length === 0) {
    return 0;
  }

  const normalized = source.replace(/\r\n?/g, '\n');
  return normalized.split('\n').length;
};

const collectFiles = async () => {
  const fileSet = new Set();

  for (const pattern of INCLUDE_GLOBS) {
    for await (const match of glob(pattern, {
      ignore: IGNORE_GLOBS,
      nodir: true
    })) {
      fileSet.add(match);
    }
  }

  return Array.from(fileSet).sort();
};

const run = async () => {
  const files = await collectFiles();

  const results = [];
  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const loc = countLoc(content);
    results.push({ filePath, loc });
  }

  const warnings = results
    .filter(({ loc }) => loc >= WARN_THRESHOLD && loc < FAIL_THRESHOLD)
    .sort((a, b) => b.loc - a.loc);

  const failures = results
    .filter(({ loc }) => loc >= FAIL_THRESHOLD)
    .sort((a, b) => b.loc - a.loc);

  if (warnings.length > 0) {
    console.warn('⚠️  LOC guard warnings (≥ ' + WARN_THRESHOLD + ' LOC):');
    for (const { filePath, loc } of warnings) {
      console.warn('   - %s (%d LOC)', toRelative(filePath), loc);
    }
  }

  if (failures.length > 0) {
    console.error('❌ LOC guard failures (≥ ' + FAIL_THRESHOLD + ' LOC):');
    for (const { filePath, loc } of failures) {
      console.error('   - %s (%d LOC)', toRelative(filePath), loc);
    }
    process.exit(1);
  }

  const max = results.reduce((acc, entry) => Math.max(acc, entry.loc), 0);
  console.log(
    '✅ LOC guard scanned %d files under packages/**/src/** (max %d LOC).',
    results.length,
    max
  );
};

run().catch((error) => {
  console.error('Failed to execute LOC guard:', error);
  process.exit(1);
});
