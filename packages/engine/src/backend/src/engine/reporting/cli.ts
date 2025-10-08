import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { generateSeedToHarvestReport } from './generateSeedToHarvestReport.ts';

interface CliArguments {
  readonly ticks?: number;
  readonly scenario?: string;
  readonly output?: string;
  readonly help?: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const scenario = args.scenario?.trim() || 'demo-world';
  const tickCount = normaliseTickCount(args.ticks);
  const report = generateSeedToHarvestReport({ ticks: tickCount, scenario });

  const repoRoot = resolveRepoRoot();
  const reportingDir = path.join(repoRoot, 'reporting');
  const defaultFileName = buildDefaultFileName(report.metadata.scenario, report.metadata.generatedAt);
  const outputName = args.output?.trim();

  if (outputName && path.isAbsolute(outputName)) {
    throw new Error('--output must be a relative path under the /reporting directory.');
  }

  const resolvedOutput = outputName ?? defaultFileName;
  const outputPath = path.join(reportingDir, resolvedOutput);

  await mkdir(reportingDir, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  process.stdout.write(`Seed-to-harvest report written to ${outputPath}\n`);
}

function parseArgs(argv: readonly string[]): CliArguments {
  let ticks: number | undefined;
  let scenario: string | undefined;
  let output: string | undefined;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];

    if (!raw) {
      continue;
    }

    if (raw === '--help' || raw === '-h') {
      help = true;
      continue;
    }

    const [flag, inlineValue] = raw.split('=', 2) as [string, string | undefined];

    switch (flag) {
      case '--ticks': {
        const value = inlineValue ?? argv[++index];

        if (!value) {
          throw new Error('--ticks requires a numeric value.');
        }

        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
          throw new Error('--ticks must be a finite number.');
        }

        ticks = parsed;
        break;
      }

      case '--scenario': {
        const value = inlineValue ?? argv[++index];

        if (!value) {
          throw new Error('--scenario requires a value.');
        }

        scenario = value;
        break;
      }

      case '--output': {
        const value = inlineValue ?? argv[++index];

        if (!value) {
          throw new Error('--output requires a value.');
        }

        output = value;
        break;
      }

      default: {
        throw new Error(`Unknown option: ${flag}`);
      }
    }
  }

  return {
    ...(ticks !== undefined ? { ticks } : {}),
    ...(scenario ? { scenario } : {}),
    ...(output ? { output } : {}),
    ...(help ? { help: true } : {})
  } satisfies CliArguments;
}

function printUsage(): void {
  const usage = `Usage: seed-to-harvest-report [options]\n\n` +
    `Options:\n` +
    `  --ticks <number>     Number of ticks to sample for the perf harness (default: 25)\n` +
    `  --scenario <name>    Scenario label to embed in the report metadata (default: demo-world)\n` +
    `  --output <file>      Relative path under /reporting for the JSON artifact\n` +
    `  -h, --help           Show this help message\n`;

  process.stdout.write(usage);
}

function normaliseTickCount(raw: number | undefined): number {
  if (typeof raw !== 'number') {
    return 25;
  }

  const ticks = Math.max(1, Math.trunc(raw));

  if (!Number.isFinite(ticks)) {
    throw new Error('Tick count must be a finite integer.');
  }

  return ticks;
}

function resolveRepoRoot(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(here, '../../../../../../..');
}

function buildDefaultFileName(scenario: string, generatedAt: string): string {
  const safeScenario = scenario.replace(/[^a-z0-9\-]+/gi, '-').replace(/-{2,}/g, '-').toLowerCase();
  const safeTimestamp = generatedAt.replace(/[:]/g, '-');
  return `seed-to-harvest-${safeScenario}-${safeTimestamp}.json`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
