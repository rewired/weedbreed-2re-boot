import { fileURLToPath } from 'node:url';

import {
  DEPENDENCY_FIELDS,
  scanWorkspace,
  type LockDependencyMap,
  type ManifestInfo
} from './scan.ts';

const DEFAULT_START_DIR = fileURLToPath(new URL('.', import.meta.url));

export interface CandidateDefinition {
  name: string;
  wanted: string;
  group: string;
  category: CandidateCategory;
  categoryReason: string;
  note?: string;
}

export type CandidateCategory = 'greenlist' | 'review' | 'skip';

export const CANDIDATES = [
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

export type Candidate = (typeof CANDIDATES)[number];

interface DependencyRecord {
  location: string;
  specifier: string;
}

export interface CandidateReport {
  candidate: Candidate;
  installed: boolean;
  versions: string[];
  locations: string[];
  directUsages: string[];
  notes: string[];
}

export interface PackageAuditSummary {
  entries: CandidateReport[];
}

export interface GeneratePackageAuditOptions {
  startDir?: string;
}

export async function generatePackageAudit(
  options: GeneratePackageAuditOptions = {}
): Promise<PackageAuditSummary> {
  const startDir = options.startDir ?? DEFAULT_START_DIR;
  const packageNames = CANDIDATES.map((candidate) => candidate.name);
  const { manifests, lockMap, directUsageMap } = await scanWorkspace({
    startDir,
    packageNames
  });

  const entries = CANDIDATES.map((candidate) => {
    const dependencyRecords: DependencyRecord[] = [];
    const versionSet = new Set<string>();

    for (const manifest of manifests) {
      collectDependencyRecords(manifest, candidate.name, dependencyRecords, versionSet, lockMap);
    }

    const notes: string[] = [];
    if (typeof candidate.note === 'string' && candidate.note.length > 0) {
      notes.push(candidate.note);
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

function collectDependencyRecords(
  manifest: ManifestInfo,
  dependencyName: string,
  records: DependencyRecord[],
  versionSet: Set<string>,
  lockMap: LockDependencyMap
) {
  for (const field of DEPENDENCY_FIELDS) {
    const deps = manifest.manifest[field];
    if (!deps) continue;

    const specifier = deps[dependencyName];
    if (typeof specifier !== 'string' || specifier.length === 0) continue;

    records.push({
      location: `${manifest.label} (${field})`,
      specifier
    });

    const locked = lockMap.get(manifest.importerKey)?.get(dependencyName)?.version;
    if (locked) {
      versionSet.add(locked);
    }
  }
}
