import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { GM_DAYS_LONG, GM_DAYS_SHORT, GOLDEN_MASTER_DAY_RUNS } from '../../constants/goldenMaster.ts';
import { fmtNum } from '../../util/format.ts';
import { runDeterministic } from '../testHarness.ts';

const FIXTURE_ROOT = fileURLToPath(
  new URL('../../../../../tests/fixtures/golden/', import.meta.url)
);

const RUNS = GOLDEN_MASTER_DAY_RUNS satisfies readonly [typeof GM_DAYS_SHORT, typeof GM_DAYS_LONG];

for (const days of RUNS) {
  const label = `${fmtNum(days)}d`;
  const outDir = path.join(FIXTURE_ROOT, label);

  console.log(`Updating golden fixtures for ${fmtNum(days)}-day run at ${outDir}`);
  runDeterministic({ days, seed: 'gm-001', outDir });
}
