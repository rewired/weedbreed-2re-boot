import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { runDeterministic } from '../testHarness.ts';

const FIXTURE_ROOT = fileURLToPath(
  new URL('../../../../../tests/fixtures/golden/', import.meta.url)
);

const RUNS = [30, 200] as const;

for (const days of RUNS) {
  const outDir = path.join(FIXTURE_ROOT, `${days}d`);
   
  console.log(`Updating golden fixtures for ${days}-day run at ${outDir}`);
  runDeterministic({ days, seed: 'gm-001', outDir });
}
