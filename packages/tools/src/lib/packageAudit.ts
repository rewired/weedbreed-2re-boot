import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globby } from 'globby';
import { parse as parseYaml } from 'yaml';

const MODULE_DIR = fileURLToPath(new URL('.', import.meta.url));

const CANDIDATES = [
  {
    name: 'uuid',
    wanted: '^9',
    group: 'Engine & determinism',
    note: 'Existing sha256-based deterministicUuid helper lives under packages/engine/src/backend/src/util/uuid.ts.'
  },
  {
    name: 'xxhash-wasm',
    wanted: '^1',
    group: 'Engine & determinism',
    note: 'Current release exposes 64-bit helpers only; 128-bit hash composed via dual seeds.'
  },
  { name: 'safe-stable-stringify', wanted: '^2', group: 'Engine & determinism' },
  { name: 'globby', wanted: '^14', group: 'Engine & determinism' },
  {
    name: 'psychrolib',
    wanted: '^2',
    group: 'Physics & math',
    note: 'Upstream npm only publishes v1.x today; monitor for v2 cut.'
  },
  {
    name: 'mathjs',
    wanted: '^13',
    group: 'Physics & math',
    note: 'Tree-shake via named imports only when adopted.'
  },
  { name: '@turf/turf', wanted: '^7', group: 'Geometry (optional / future)' },
  { name: 'zod-to-json-schema', wanted: '^3', group: 'Schemas & typing' },
  { name: 'type-fest', wanted: '^4', group: 'Schemas & typing' },
  { name: 'rxjs', wanted: '^7', group: 'Pipelines & events' },
  { name: 'mitt', wanted: '^3', group: 'Pipelines & events' },
  { name: 'eventemitter3', wanted: '^5', group: 'Pipelines & events' },
  { name: 'commander', wanted: '^12', group: 'CLI, logging & DX' },
  { name: 'pino', wanted: '^9', group: 'CLI, logging & DX' },
  { name: 'pino-pretty', wanted: '^11', group: 'CLI, logging & DX' },
  { name: 'cli-table3', wanted: '^0.6', group: 'CLI, logging & DX' },
  { name: 'fast-check', wanted: '^3', group: 'Tests & quality' },
  { name: 'vitest-fetch-mock', wanted: '^0.4', group: 'Tests & quality' },
  { name: 'msw', wanted: '^2', group: 'Tests & quality' },
  { name: 'neo-blessed', wanted: '^0.2', group: 'Terminal monitor (optional)' },
  { name: 'blessed-contrib', wanted: '^5', group: 'Terminal monitor (optional)' }
] as const;

type Candidate = (typeof CANDIDATES)[number];

interface ManifestInfo {
  dir: string;
  relativeDir: string;
  label: string;
  manifest: Record<string, any>;
}

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

  const entries = await Promise.all(
    CANDIDATES.map(async (candidate) => {
      const dependencyRecords: DependencyRecord[] = [];
      const versionSet = new Set<string>();

      for (const manifest of manifests) {
        for (const field of [
          'dependencies',
          'devDependencies',
          'optionalDependencies',
          'peerDependencies'
        ]) {
          const deps = manifest.manifest[field];
          if (!deps) continue;

          const specifier = deps[candidate.name];
          if (!specifier) continue;

          dependencyRecords.push({
            location: `${manifest.label} (${field})`,
            specifier: String(specifier)
          });

          const importerKey = normaliseImporterKey(manifest.relativeDir);
          const locked = lockMap
            .get(importerKey)
            ?.get(candidate.name)?.version;
          if (locked) {
            versionSet.add(String(locked));
          }
        }
      }

      const notes: string[] = [];
      if (candidate.note) {
        notes.push(candidate.note);
      }

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
    })
  );

  return { entries };
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
      const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8'));
      const label = typeof manifestJson.name === 'string' ? manifestJson.name : relativeDir;

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
      const relative = path.relative(repoRoot, filePath);
      const owner = manifest?.label ?? relative.split(path.sep)[0];
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
  let current = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(current, 'pnpm-workspace.yaml');
    if (await pathExists(candidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate repository root');
    }
    current = parent;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function loadPnpmLock(repoRoot: string): Promise<LockDependencyMap> {
  const lockPath = path.join(repoRoot, 'pnpm-lock.yaml');
  const map: LockDependencyMap = new Map();

  if (!(await pathExists(lockPath))) {
    return map;
  }

  const raw = await readFile(lockPath, 'utf8');
  const parsed = parseYaml(raw) as any;
  const importers = parsed?.importers ?? {};

  for (const [importerKey, importerValue] of Object.entries(importers)) {
    const depMap = new Map<string, LockDependencyEntry>();
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies'
    ]) {
      const section = (importerValue as any)[field];
      if (!section) continue;

      for (const [depName, info] of Object.entries(section as Record<string, any>)) {
        const entry = info as { version?: string; specifier?: string };
        depMap.set(depName, {
          version: entry.version ? String(entry.version) : '',
          specifier: entry.specifier ? String(entry.specifier) : ''
        });
      }
    }
    map.set(normaliseImporterKey(importerKey), depMap);
  }

  return map;
}

function normaliseImporterKey(relativeDir: string): string {
  return relativeDir === '.' ? '.' : relativeDir.replace(/\\/g, '/');
}

export { CANDIDATES };
