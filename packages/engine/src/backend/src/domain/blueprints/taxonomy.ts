import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BLUEPRINTS_ROOT = path.resolve(
  fileURLToPath(new URL('../../../../../../../', import.meta.url)),
  'data/blueprints'
);
const TAXONOMY_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface BlueprintTaxonomyFromPath {
  readonly expectedClass: string;
  readonly relativePath: string;
  readonly allowNamespaceSuffix: boolean;
}

export interface BlueprintPathOptions {
  readonly blueprintsRoot?: string;
}

export class BlueprintPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlueprintPathError';
  }
}

export class BlueprintTaxonomyMismatchError extends Error {
  constructor(
    readonly filePath: string,
    readonly expectedClass: string,
    readonly actualClass: string
  ) {
    super(
      `Blueprint class mismatch for "${filePath}": expected "${expectedClass}" derived from the folder taxonomy, received "${actualClass}".`
    );
    this.name = 'BlueprintTaxonomyMismatchError';
  }
}

function normaliseBlueprintRoot(root?: string): string {
  if (!root) {
    return DEFAULT_BLUEPRINTS_ROOT;
  }

  return path.isAbsolute(root) ? path.normalize(root) : path.resolve(root);
}

function toTaxonomySegment(raw: string): string {
  const normalised = raw.trim().replace(/[\s_]+/g, '-').toLowerCase();
  const collapsed = normalised.replace(/-+/g, '-');

  if (!TAXONOMY_SEGMENT_PATTERN.test(collapsed)) {
    throw new BlueprintPathError(
      `Path segment "${raw}" must be lowercase kebab-case to participate in the taxonomy.`
    );
  }

  return collapsed;
}

function toRelativeBlueprintPath(filePath: string, root: string): string {
  const relative = path.relative(root, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new BlueprintPathError(
      `Blueprint file "${filePath}" must reside under "${root}" to derive taxonomy metadata.`
    );
  }

  return relative.split(path.sep).filter(Boolean).join('/');
}

export function deriveBlueprintClassFromPath(
  filePath: string,
  options?: BlueprintPathOptions
): BlueprintTaxonomyFromPath {
  if (!filePath) {
    throw new BlueprintPathError('Blueprint file path is required to derive taxonomy metadata.');
  }

  const absolutePath = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(filePath);
  const root = normaliseBlueprintRoot(options?.blueprintsRoot);
  const relativePath = toRelativeBlueprintPath(absolutePath, root);
  const segments = relativePath.split('/');
  const directorySegments = segments.slice(0, -1);

  if (directorySegments.length === 0) {
    throw new BlueprintPathError(
      `Blueprint path "${relativePath}" must include at least <domain>/<file>.`
    );
  }

  if (directorySegments.length > 2) {
    throw new BlueprintPathError(
      `Blueprint path "${relativePath}" must not exceed two directories under the blueprints root.`
    );
  }

  const [domainSegment, nestedSegment] = directorySegments;
  const domain = toTaxonomySegment(domainSegment);

  if (!nestedSegment) {
    return {
      expectedClass: domain,
      allowNamespaceSuffix: false,
      relativePath
    } satisfies BlueprintTaxonomyFromPath;
  }

  const nested = toTaxonomySegment(nestedSegment);

  if (domain === 'device') {
    return {
      expectedClass: `${domain}.${nested}`,
      allowNamespaceSuffix: false,
      relativePath
    } satisfies BlueprintTaxonomyFromPath;
  }

  if (domain === 'room' || domain === 'personnel') {
    return {
      expectedClass: `${domain}.${nested}`,
      allowNamespaceSuffix: true,
      relativePath
    } satisfies BlueprintTaxonomyFromPath;
  }

  throw new BlueprintPathError(
    `Blueprint path "${relativePath}" contains unsupported nested directory "${nested}" under domain "${domain}".`
  );
}

export function assertBlueprintClassMatchesPath(
  declaredClass: string,
  filePath: string,
  options?: BlueprintPathOptions
): void {
  const derived = deriveBlueprintClassFromPath(filePath, options);
  const expected = derived.expectedClass;

  if (derived.allowNamespaceSuffix) {
    if (declaredClass !== expected && !declaredClass.startsWith(`${expected}.`)) {
      throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, declaredClass);
    }
    return;
  }

  if (declaredClass !== expected) {
    throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, declaredClass);
  }
}
