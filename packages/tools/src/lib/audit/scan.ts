import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globby } from 'globby';
import { parse as parseYaml } from 'yaml';

const DEFAULT_START_DIR = fileURLToPath(new URL('.', import.meta.url));

export type DependencyField =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies';

export interface PackageManifest {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface ManifestInfo {
  dir: string;
  relativeDir: string;
  importerKey: string;
  label: string;
  manifest: PackageManifest;
}

export interface LockDependencyEntry {
  version: string;
  specifier: string;
}

export type LockDependencyMap = Map<string, Map<string, LockDependencyEntry>>;

export interface WorkspaceScan {
  repoRoot: string;
  manifests: ManifestInfo[];
  lockMap: LockDependencyMap;
  directUsageMap: Map<string, Set<string>>;
}

export interface ScanOptions {
  startDir?: string;
  packageNames: string[];
}

export const DEPENDENCY_FIELDS: DependencyField[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
];

export async function scanWorkspace({
  startDir = DEFAULT_START_DIR,
  packageNames
}: ScanOptions): Promise<WorkspaceScan> {
  const repoRoot = await findRepoRoot(startDir);
  const manifests = await loadManifests(repoRoot);
  const lockMap = await loadPnpmLock(repoRoot);
  const directUsageMap = await detectDirectUsage(repoRoot, manifests, packageNames);

  return { repoRoot, manifests, lockMap, directUsageMap };
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
      const importerKey = normaliseImporterKey(relativeDir);
      const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest;
      const label = typeof manifestJson.name === 'string' && manifestJson.name.length > 0 ? manifestJson.name : relativeDir;

      return { dir, relativeDir, importerKey, label, manifest: manifestJson } satisfies ManifestInfo;
    })
  );
}

async function detectDirectUsage(
  repoRoot: string,
  manifests: ManifestInfo[],
  packageNames: string[]
): Promise<Map<string, Set<string>>> {
  const usage = new Map<string, Set<string>>();

  if (packageNames.length === 0) {
    return usage;
  }

  const files = await globby('packages/*/src/**/*.{ts,tsx,js,mjs,cjs}', {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  const manifestByDir = manifests
    .map((manifest) => ({ ...manifest, dirWithSep: `${manifest.dir}${path.sep}` }))
    .sort((a, b) => b.dirWithSep.length - a.dirWithSep.length);

  for (const filePath of files) {
    const normalizedFilePath = path.normalize(filePath);
    const contents = await readFile(filePath, 'utf8');

    for (const pkg of packageNames) {
      if (!containsImport(contents, pkg)) continue;

      const manifest = manifestByDir.find((candidate) => normalizedFilePath.startsWith(candidate.dirWithSep));
      const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
      const owner = manifest?.label ?? relative.split('/')[0];
      const list = ensureUsageSet(usage, pkg);
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
