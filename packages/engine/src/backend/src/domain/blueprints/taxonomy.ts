import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BLUEPRINTS_ROOT = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../../data/blueprints'
);
const TAXONOMY_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface BlueprintTaxonomyFromPath {
  readonly className: string;
  readonly domain: string;
  readonly effect: string;
  readonly variants: readonly string[];
  readonly relativePath: string;
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

export class BlueprintClassMismatchError extends Error {
  constructor(
    readonly filePath: string,
    readonly expectedClass: string,
    readonly actualClass: string
  ) {
    super(
      `Blueprint class mismatch for "${filePath}": expected "${expectedClass}" derived from the folder taxonomy, received "${actualClass}".`
    );
    this.name = 'BlueprintClassMismatchError';
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

  if (segments.length < 3) {
    throw new BlueprintPathError(
      `Blueprint path "${relativePath}" must include at least <domain>/<effect>/<file>.`
    );
  }

  const directorySegments = segments.slice(0, -1);

  if (directorySegments.length < 2) {
    throw new BlueprintPathError(
      `Blueprint path "${relativePath}" must declare both domain and effect folders.`
    );
  }

  const [domainSegment, effectSegment, ...rest] = directorySegments;
  const domain = toTaxonomySegment(domainSegment);
  const effect = toTaxonomySegment(effectSegment);
  const variants = rest.map(toTaxonomySegment);
  const className = [domain, effect, ...variants].join('.');

  return {
    className,
    domain,
    effect,
    variants,
    relativePath
  } satisfies BlueprintTaxonomyFromPath;
}

export function assertBlueprintClassMatchesPath(
  declaredClass: string,
  filePath: string,
  options?: BlueprintPathOptions
): void {
  const derived = deriveBlueprintClassFromPath(filePath, options);

  if (declaredClass !== derived.className) {
    throw new BlueprintClassMismatchError(derived.relativePath, derived.className, declaredClass);
  }
}
