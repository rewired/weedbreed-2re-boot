import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globby } from 'globby';
import { parse as parseYaml } from 'yaml';

const MODULE_DIR = fileURLToPath(new URL('.', import.meta.url));

interface CandidateDefinition {
  name: string;
  wanted: string;
  group: string;
  category: CandidateCategory;
  categoryReason: string;
  note?: string;
}

const CANDIDATES = [
  {
    name: 'uuid',
    wanted: '^9',
    group: 'Engine & determinism',
    category: 'greenlist',
    categoryReason:
      'Deterministic scaffolds only; keep parity with existing helpers before touching runtime flows.',
    note: 'Existing sha256-based deterministicUuid helper lives under packages/engine/src/backend/src/util/uuid.ts.'
  },
  {
    name: 'xxhash-wasm',
    wanted: '^1',
    group: 'Engine & determinism',
    category: 'greenlist',
    categoryReason:
      'Test-only hashing helper; aligns with deterministic checksum scaffolds without runtime hooks yet.',
    note: 'Current release exposes 64-bit helpers only; 128-bit hash composed via dual seeds.'
  },
  {
    name: 'safe-stable-stringify',
    wanted: '^2',
    group: 'Engine & determinism',
    category: 'greenlist',
    categoryReason: 'Used for canonical JSON hashing in tests; no production wiring planned until determinism ADR.'
  },
  {
    name: 'globby',
    wanted: '^14',
    group: 'Engine & determinism',
    category: 'greenlist',
    categoryReason: 'Tooling helper only; drives report discovery without impacting runtime bundles.'
  },
  {
    name: 'psychrolib',
    wanted: '^2',
    group: 'Physics & math',
    category: 'review',
    categoryReason: 'Hold for v2 upstream release (or vetted fork) before wiring psychrometrics into the pipeline.',
    note: 'Upstream npm only publishes v1.x today; monitor for v2 cut.'
  },
  {
    name: 'mathjs',
    wanted: '^13',
    group: 'Physics & math',
    category: 'skip',
    categoryReason: 'Defer until we formalise tree-shaking and bundle footprint guardrails.'
  },
  {
    name: '@turf/turf',
    wanted: '^7',
    group: 'Geometry (optional / future)',
    category: 'skip',
    categoryReason: 'Spatial tooling is future-facing; no geometry ADR approved yet.'
  },
  {
    name: 'zod-to-json-schema',
    wanted: '^3',
    group: 'Schemas & typing',
    category: 'skip',
    categoryReason: 'Schema export automation can wait until façade contracts stabilise.'
  },
  {
    name: 'type-fest',
    wanted: '^4',
    group: 'Schemas & typing',
    category: 'skip',
    categoryReason: 'Additional TS utility types not required for current contracts.'
  },
  {
    name: 'rxjs',
    wanted: '^7',
    group: 'Pipelines & events',
    category: 'skip',
    categoryReason: 'Reactive stream layer unscheduled; existing event emitters cover needs.'
  },
  {
    name: 'mitt',
    wanted: '^3',
    group: 'Pipelines & events',
    category: 'skip',
    categoryReason: 'Redundant to current event emitter options; leave out until event bus ADR.'
  },
  {
    name: 'eventemitter3',
    wanted: '^5',
    group: 'Pipelines & events',
    category: 'skip',
    categoryReason: 'Hold until we benchmark emitter stacking for the façade/transport boundary.'
  },
  {
    name: 'commander',
    wanted: '^12',
    group: 'CLI, logging & DX',
    category: 'greenlist',
    categoryReason: 'CLI framework limited to tooling scope; deterministic for reports.'
  },
  {
    name: 'pino',
    wanted: '^9',
    group: 'CLI, logging & DX',
    category: 'greenlist',
    categoryReason: 'Structured logging for tooling only; production stack remains unchanged.'
  },
  {
    name: 'pino-pretty',
    wanted: '^11',
    group: 'CLI, logging & DX',
    category: 'review',
    categoryReason: 'Keep pretty transport opt-in so CI logs stay terse.'
  },
  {
    name: 'cli-table3',
    wanted: '^0.6',
    group: 'CLI, logging & DX',
    category: 'greenlist',
    categoryReason: 'Console formatting helper scoped to reports only.'
  },
  {
    name: 'fast-check',
    wanted: '^3',
    group: 'Tests & quality',
    category: 'greenlist',
    categoryReason: 'Property testing library stays confined to tests.'
  },
  {
    name: 'vitest-fetch-mock',
    wanted: '^0.4',
    group: 'Tests & quality',
    category: 'skip',
    categoryReason: 'Facade tests do not require fetch mocking yet; evaluate alongside transport work.'
  },
  {
    name: 'msw',
    wanted: '^2',
    group: 'Tests & quality',
    category: 'skip',
    categoryReason: 'Network mocking remains out-of-scope until UI transport harness matures.'
  },
  {
    name: 'neo-blessed',
    wanted: '^0.2',
    group: 'Terminal monitor (optional)',
    category: 'skip',
    categoryReason: 'Terminal monitor deferred; revisit during monitoring sprint.'
  },
  {
    name: 'blessed-contrib',
    wanted: '^5',
    group: 'Terminal monitor (optional)',
    category: 'skip',
    categoryReason: 'Depends on the terminal monitor initiative; skip for now.'
  }
] satisfies readonly CandidateDefinition[];

type CandidateCategory = 'greenlist' | 'review' | 'skip';

type Candidate = (typeof CANDIDATES)[number];

type DependencyField =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies';

interface PackageManifest {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface ManifestInfo {
  dir: string;
  relativeDir: string;
  label: string;
  manifest: PackageManifest;
}

const DEPENDENCY_FIELDS: DependencyField[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
];

interface DependencyRecord {
  location: string;
  specifier: string;
}

interface CandidateReport {
  candidate: Candidate;
  installed: boolean;
  versions: string[];
  locations: string[];
  directUsages: string[];
  notes: string[];
}

interface PackageAuditSummary {
  entries: CandidateReport[];
}

const CATEGORY_LABEL: Record<CandidateCategory, string> = {
  greenlist: 'Greenlist',
  review: 'Review',
  skip: 'Skip'
};

const NO_GO_CRITERIA = [
  'Introduce runtime UUID/hash replacements without aligning with packages/engine/src/backend/src/util/uuid.ts.',
  'Adopt psychrolib in production flows before securing a maintained ^2 release or validating 1.x compatibility formally.',
  'Pull mathjs (or similar heavy dependencies) without a documented tree-shaking plan and bundle budget.'
];

const FOLLOW_UP_TASKS = [
  'Task 0007 keeps determinism helpers test-only until an ADR approves runtime adoption.',
  'Task 0009 will cover psychrometric wiring once psychrolib v2 (or alternative) is stable.'
];

interface LockDependencyEntry {
  version: string;
  specifier: string;
}

type LockDependencyMap = Map<string, Map<string, LockDependencyEntry>>;

const repoRootPromise = findRepoRoot(MODULE_DIR);

export async function generatePackageAudit(): Promise<{ entries: CandidateReport[] }> {
  const repoRoot = await repoRootPromise;
  const manifests = await loadManifests(repoRoot);
  const lockMap = await loadPnpmLock(repoRoot);
  const directUsageMap = await detectDirectUsage(repoRoot, manifests);

  const entries = CANDIDATES.map((candidate) => {
      const dependencyRecords: DependencyRecord[] = [];
      const versionSet = new Set<string>();

      for (const manifest of manifests) {
        for (const field of DEPENDENCY_FIELDS) {
          const deps = manifest.manifest[field];
          if (!deps) continue;

          const specifier = deps[candidate.name];
          if (typeof specifier !== 'string' || specifier.length === 0) continue;

          dependencyRecords.push({
            location: `${manifest.label} (${field})`,
            specifier
          });

          const importerKey = normaliseImporterKey(manifest.relativeDir);
          const locked = lockMap
            .get(importerKey)
            ?.get(candidate.name)?.version;
          if (locked) {
            versionSet.add(locked);
          }
        }
      }

    const notes: string[] = [];
    const candidateNote = candidate.note;
    if (typeof candidateNote === 'string' && candidateNote.length > 0) {
      notes.push(candidateNote);
    }

      notes.push(candidate.categoryReason);

      if (candidate.group.startsWith('Terminal') && dependencyRecords.length === 0) {
        notes.push('Optional monitor tooling; defer until terminal UX sprint.');
      }

      if (
        dependencyRecords.length > 0 &&
        dependencyRecords.some((record) => !record.specifier.includes(candidate.wanted))
      ) {
        notes.push('Installed range diverges from prompt target; verify before rollout.');
      }

      if (dependencyRecords.length === 0 && versionSet.size === 0) {
        versionSet.add('—');
      }

      const directUsage = Array.from(directUsageMap.get(candidate.name) ?? []).sort();

      return {
        candidate,
        installed: dependencyRecords.length > 0,
        versions: Array.from(versionSet).sort(),
        locations: dependencyRecords.map((record) => record.location).sort(),
        directUsages: directUsage,
        notes
      } satisfies CandidateReport;
    });

  return { entries };
}

export function renderPackageAuditMarkdown(summary: PackageAuditSummary): string {
  const lines: string[] = [];
  const { entries } = summary;

  lines.push('# Package Audit & Reporting Matrix');
  lines.push('');
  lines.push(
    '_Generated via `pnpm report:packages` — deterministic snapshot of candidate tooling dependencies._'
  );
  lines.push('');
  lines.push('## Scope & Inputs');
  lines.push('');
  lines.push('- Parsed `package.json` for the root workspace and `packages/*` (pnpm workspaces).');
  lines.push('- Parsed `pnpm-lock.yaml` to resolve locked versions per importer.');
  lines.push('- Searched `packages/*/src/**` for direct imports/requires of candidate packages.');
  lines.push('- Classified candidates into Greenlist / Review / Skip buckets with rationale.');
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  lines.push(
    '| Package | Wanted | Installed? | Version(s) | Location(s) | Direct Usage?* | Category | Notes |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const entry of entries) {
    const versions =
      entry.versions.length === 1 && entry.versions[0] === '—'
        ? '—'
        : entry.versions.map((version) => `\`${escapePipes(version)}\``).join('<br>');
    const locations = formatList(entry.locations);
    const directUsage = formatList(entry.directUsages);
    const notes = formatList(entry.notes.map(escapePipes));
    const installed = entry.installed ? '✅' : '❌';
    const category = CATEGORY_LABEL[entry.candidate.category];

    lines.push(
      `| \`${entry.candidate.name}\` | \`${entry.candidate.wanted}\` | ${installed} | ${versions} | ${locations} | ${directUsage} | ${category} | ${notes} |`
    );
  }

  lines.push('');
  lines.push('> *Direct usage = imports/requires within `packages/*/src/**`.');
  lines.push('');

  for (const category of ['greenlist', 'review', 'skip'] as CandidateCategory[]) {
    const label = CATEGORY_LABEL[category];
    lines.push(`## ${label}`);
    lines.push('');

    const relevant = entries.filter((entry) => entry.candidate.category === category);

    if (relevant.length === 0) {
      lines.push('- _No entries._');
    } else {
      for (const entry of relevant) {
        lines.push(`- \`${entry.candidate.name}\` — ${entry.candidate.categoryReason}`);
      }
    }

    lines.push('');
  }

  lines.push('## Follow-up Tasks');
  lines.push('');
  for (const task of FOLLOW_UP_TASKS) {
    lines.push(`- ${task}`);
  }
  lines.push('');

  lines.push('## No-Go Criteria');
  lines.push('');
  for (const item of NO_GO_CRITERIA) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  return lines.join('\n');
}

async function loadManifests(repoRoot: string): Promise<ManifestInfo[]> {
  const patterns = [
    'package.json',
    'packages/*/package.json',
    'apps/*/package.json',
    'tools/*/package.json'
  ];

  const manifestPaths = await globby(patterns, {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  return Promise.all(
    manifestPaths.map(async (manifestPath) => {
      const dir = path.dirname(manifestPath);
      const relativeDir = path.relative(repoRoot, dir) || '.';
      const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest;
      const label = typeof manifestJson.name === 'string' && manifestJson.name.length > 0 ? manifestJson.name : relativeDir;

      return { dir, relativeDir, label, manifest: manifestJson } satisfies ManifestInfo;
    })
  );
}

async function detectDirectUsage(
  repoRoot: string,
  manifests: ManifestInfo[]
): Promise<Map<string, Set<string>>> {
  const files = await globby('packages/*/src/**/*.{ts,tsx,js,mjs,cjs}', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  const manifestByDir = manifests
    .map((manifest) => ({ ...manifest, dirWithSep: `${manifest.dir}${path.sep}` }))
    .sort((a, b) => b.dirWithSep.length - a.dirWithSep.length);

  const usage = new Map<string, Set<string>>();

  for (const filePath of files) {
    const contents = await readFile(filePath, 'utf8');

    for (const candidate of CANDIDATES) {
      if (!containsImport(contents, candidate.name)) continue;

      const manifest = manifestByDir.find((pkg) => filePath.startsWith(pkg.dirWithSep));
      const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
      const owner = manifest?.label ?? relative.split('/')[0];
      const list = ensureUsageSet(usage, candidate.name);
      list.add(`${owner}: ${relative}`);
    }
  }

  return usage;
}

function containsImport(contents: string, pkg: string): boolean {
  const tokens = [
    `from '${pkg}`,
    `from "${pkg}`,
    `from \`${pkg}`,
    `require('${pkg}`,
    `require("${pkg}`,
    `require(\`${pkg}`,
    `import('${pkg}`,
    `import("${pkg}`,
    `import(\`${pkg}`
  ];

  return tokens.some((token) => contents.includes(token));
}

function ensureUsageSet(map: Map<string, Set<string>>, key: string) {
  let existing = map.get(key);
  if (!existing) {
    existing = new Set<string>();
    map.set(key, existing);
  }
  return existing;
}

async function findRepoRoot(startDir: string): Promise<string> {
  const candidate = path.join(startDir, 'pnpm-workspace.yaml');
  if (await pathExists(candidate)) {
    return startDir;
  }

  const parent = path.dirname(startDir);
  if (parent === startDir) {
    throw new Error('Unable to locate repository root');
  }

  return findRepoRoot(parent);
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

interface PnpmLockDependencyInfo {
  version?: string;
  specifier?: string;
}

interface PnpmLockImporter {
  dependencies?: Record<string, PnpmLockDependencyInfo>;
  devDependencies?: Record<string, PnpmLockDependencyInfo>;
  optionalDependencies?: Record<string, PnpmLockDependencyInfo>;
  peerDependencies?: Record<string, PnpmLockDependencyInfo>;
}

interface PnpmLockFile {
  importers?: Record<string, PnpmLockImporter>;
}

async function loadPnpmLock(repoRoot: string): Promise<LockDependencyMap> {
  const lockPath = path.join(repoRoot, 'pnpm-lock.yaml');
  const map: LockDependencyMap = new Map();

  if (!(await pathExists(lockPath))) {
    return map;
  }

  const raw = await readFile(lockPath, 'utf8');
  const parsed = parseYaml(raw) as PnpmLockFile;
  const importers = parsed.importers ?? {};

  for (const [importerKey, importerValue] of Object.entries(importers)) {
    const depMap = new Map<string, LockDependencyEntry>();
    for (const field of DEPENDENCY_FIELDS) {
      const section = importerValue[field];
      if (!section) continue;

      for (const [depName, info] of Object.entries(section)) {
        const version = typeof info.version === 'string' ? info.version : '';
        const specifier = typeof info.specifier === 'string' ? info.specifier : '';
        depMap.set(depName, { version, specifier });
      }
    }
    map.set(normaliseImporterKey(importerKey), depMap);
  }

  return map;
}

function normaliseImporterKey(relativeDir: string): string {
  return relativeDir === '.' ? '.' : relativeDir.replace(/\\/g, '/');
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return '—';
  }
  return values.map(escapePipes).join('<br>');
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export { CANDIDATES };
