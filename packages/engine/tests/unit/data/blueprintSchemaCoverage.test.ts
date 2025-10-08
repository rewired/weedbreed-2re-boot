import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseContainerBlueprint,
  parseCultivationMethodBlueprint,
  parseDeviceBlueprint,
  parseDiseaseBlueprint,
  parseIrrigationBlueprint,
  parsePestBlueprint,
  parsePersonnelRoleBlueprint,
  parsePersonnelSkillBlueprint,
  parseRoomPurposeBlueprint,
  parseStructureBlueprint,
  parseStrainBlueprint,
  parseSubstrateBlueprint
} from '@/backend/src/domain/blueprints/index';
import { resolveBlueprintPath } from '../../testUtils/paths.ts';

type ParserFn = (input: unknown, context: { readonly filePath: string; readonly relativePath: string }) => void;

const blueprintRoot = resolveBlueprintPath('');

function listBlueprintFiles(relativeDir = ''): string[] {
  const absolute = relativeDir ? path.join(blueprintRoot, relativeDir) : blueprintRoot;
  const entries = readdirSync(absolute, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextRelative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...listBlueprintFiles(nextRelative));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(nextRelative);
    }
  }

  return files.sort();
}

function readBlueprint(relativePath: string): unknown {
  const filePath = resolveBlueprintPath(relativePath);
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

const substrateSlugRegistry = (() => {
  const slugs = new Set<string>();
  const substrateFiles = listBlueprintFiles('substrate');

  for (const relative of substrateFiles) {
    const filePath = resolveBlueprintPath(relative);
    const parsed = parseSubstrateBlueprint(readBlueprint(relative), { filePath });
    slugs.add(parsed.slug);
  }

  return slugs;
})();

function resolveParser(relativePath: string): { readonly label: string; readonly parse: ParserFn } {
  const [domain, namespace] = relativePath.split('/');
  const filePath = resolveBlueprintPath(relativePath);

  switch (domain) {
    case 'container':
      return {
        label: 'container',
        parse: (input, _context) => {
          parseContainerBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'cultivation-method':
      return {
        label: 'cultivation-method',
        parse: (input, _context) => {
          parseCultivationMethodBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'structure':
      return {
        label: 'structure',
        parse: (input, _context) => {
          parseStructureBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'room':
      if (namespace === 'purpose') {
        return {
          label: 'room.purpose',
          parse: (input, _context) => {
            parseRoomPurposeBlueprint(input, { filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      break;
    case 'disease':
      return {
        label: 'disease',
        parse: (input, _context) => {
          parseDiseaseBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'pest':
      return {
        label: 'pest',
        parse: (input, _context) => {
          parsePestBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'personnel':
      if (namespace === 'role') {
        return {
          label: 'personnel.role',
          parse: (input, _context) => {
            parsePersonnelRoleBlueprint(input, { filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      if (namespace === 'skill') {
        return {
          label: 'personnel.skill',
          parse: (input, _context) => {
            parsePersonnelSkillBlueprint(input, { filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      break;
    case 'device':
      return {
        label: 'device',
        parse: (input, _context) => {
          parseDeviceBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'irrigation':
      return {
        label: 'irrigation',
        parse: (input, _context) => {
          parseIrrigationBlueprint(input, { filePath, knownSubstrateSlugs: substrateSlugRegistry });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'strain':
      return {
        label: 'strain',
        parse: (input, _context) => {
          parseStrainBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'substrate':
      return {
        label: 'substrate',
        parse: (input, _context) => {
          parseSubstrateBlueprint(input, { filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    default:
      throw new Error(`No parser registered for blueprint path "${relativePath}".`);
  }

  throw new Error(`Unsupported personnel blueprint namespace in path "${relativePath}".`);
}

interface StrictCase {
  readonly label: string;
  readonly samplePath: string;
  readonly parse: ParserFn;
}

const strictBlueprintCases: readonly StrictCase[] = [
  {
    label: 'container',
    samplePath: 'container/pot-10l.json',
    parse: (input, ctx) => parseContainerBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'cultivation-method',
    samplePath: 'cultivation-method/basic-soil-pot.json',
    parse: (input, ctx) => parseCultivationMethodBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'structure',
    samplePath: 'structure/shed.json',
    parse: (input, ctx) => parseStructureBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'room.purpose',
    samplePath: 'room/purpose/growroom.json',
    parse: (input, ctx) => parseRoomPurposeBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'disease',
    samplePath: 'disease/botrytis-gray-mold-bud-rot.json',
    parse: (input, ctx) => parseDiseaseBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'pest',
    samplePath: 'pest/aphids.json',
    parse: (input, ctx) => parsePestBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'personnel.role',
    samplePath: 'personnel/role/gardener.json',
    parse: (input, ctx) => parsePersonnelRoleBlueprint(input, { filePath: ctx.filePath })
  },
  {
    label: 'personnel.skill',
    samplePath: 'personnel/skill/gardening.json',
    parse: (input, ctx) => parsePersonnelSkillBlueprint(input, { filePath: ctx.filePath })
  }
];

describe('blueprint schema coverage', () => {
  it('parses every blueprint using the canonical schemas', () => {
    const relativePaths = listBlueprintFiles();
    const summary = new Map<string, number>();

    for (const relative of relativePaths) {
      const parser = resolveParser(relative);
      expect(() => { parser.parse(readBlueprint(relative), { filePath: resolveBlueprintPath(relative), relativePath: relative }); })
        .not.toThrow();

      summary.set(parser.label, (summary.get(parser.label) ?? 0) + 1);
    }

    const summaryLine = Array.from(summary.entries())
      .map(([label, count]) => `${label}=${count}`)
      .join(', ');

    console.info(`[Blueprint coverage] ${summaryLine}`);
  });

  describe.each(strictBlueprintCases)('%s strict schema guards', (testCase) => {
    const filePath = resolveBlueprintPath(testCase.samplePath);

    it('rejects missing required fields', () => {
      const blueprint = readBlueprint(testCase.samplePath) as Record<string, unknown>;
      const invalid = { ...blueprint };
      delete invalid.id;

      expect(() => { testCase.parse(invalid, { filePath, relativePath: testCase.samplePath }); }).toThrow();
    });

    it('rejects unexpected top-level properties', () => {
      const blueprint = readBlueprint(testCase.samplePath) as Record<string, unknown>;
      const invalid = { ...blueprint, __unexpected: true };

      expect(() => { testCase.parse(invalid, { filePath, relativePath: testCase.samplePath }); }).toThrow();
    });
  });
});
