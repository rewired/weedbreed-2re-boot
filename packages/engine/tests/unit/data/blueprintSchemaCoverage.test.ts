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
import { fmtNum } from '@/backend/src/util/format.ts';

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
  switch (domain) {
    case 'container':
      return {
        label: 'container',
        parse: (input, context) => {
          parseContainerBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'cultivation-method':
      return {
        label: 'cultivation-method',
        parse: (input, context) => {
          parseCultivationMethodBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'structure':
      return {
        label: 'structure',
        parse: (input, context) => {
          parseStructureBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'room':
      if (namespace === 'purpose') {
        return {
          label: 'room.purpose',
          parse: (input, context) => {
            parseRoomPurposeBlueprint(input, { filePath: context.filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      break;
    case 'disease':
      return {
        label: 'disease',
        parse: (input, context) => {
          parseDiseaseBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'pest':
      return {
        label: 'pest',
        parse: (input, context) => {
          parsePestBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'personnel':
      if (namespace === 'role') {
        return {
          label: 'personnel.role',
          parse: (input, context) => {
            parsePersonnelRoleBlueprint(input, { filePath: context.filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      if (namespace === 'skill') {
        return {
          label: 'personnel.skill',
          parse: (input, context) => {
            parsePersonnelSkillBlueprint(input, { filePath: context.filePath });
          }
        } satisfies { label: string; parse: ParserFn };
      }
      break;
    case 'device':
      return {
        label: 'device',
        parse: (input, context) => {
          parseDeviceBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'irrigation':
      return {
        label: 'irrigation',
        parse: (input, context) => {
          parseIrrigationBlueprint(input, { filePath: context.filePath, knownSubstrateSlugs: substrateSlugRegistry });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'strain':
      return {
        label: 'strain',
        parse: (input, context) => {
          parseStrainBlueprint(input, { filePath: context.filePath });
        }
      } satisfies { label: string; parse: ParserFn };
    case 'substrate':
      return {
        label: 'substrate',
        parse: (input, context) => {
          parseSubstrateBlueprint(input, { filePath: context.filePath });
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
      .map(([label, count]) => `${label}=${fmtNum(count)}`)
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
