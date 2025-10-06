import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runDeterministic } from '../dist/engine/testHarness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const worldSeedPath = resolve(__dirname, '../tests/fixtures/golden/world_v1.seed.json');
const worldSeed = JSON.parse(readFileSync(worldSeedPath, 'utf8'));

function generate(days, summaryTarget, dailyTarget) {
  const result = runDeterministic({ days, seed: 'gm-001', world: worldSeed });
  writeFileSync(summaryTarget, `${JSON.stringify(result.summary, null, 2)}\n`);
  writeFileSync(dailyTarget, `${JSON.stringify(result.daily, null, 2)}\n`);
}

const baseDir = resolve(__dirname, '../tests/fixtures/golden');

generate(
  7,
  resolve(baseDir, 'summary_v1_7d.json'),
  resolve(baseDir, 'daily_v1_7d.json')
);

generate(
  30,
  resolve(baseDir, 'summary_v1_30d.json'),
  resolve(baseDir, 'daily_v1_30d.json')
);
