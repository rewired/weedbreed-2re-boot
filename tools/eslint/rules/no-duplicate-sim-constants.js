import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANONICAL_RELATIVE_PATH = path.posix.join(
  'packages',
  'engine',
  'src',
  'backend',
  'src',
  'constants',
  'simConstants.ts'
);

const CANONICAL_ABSOLUTE_PATH = path.normalize(
  fileURLToPath(new URL('../../../' + CANONICAL_RELATIVE_PATH, import.meta.url))
);

const CANONICAL_CONSTANT_NAMES = new Set([
  'AREA_QUANTUM_M2',
  'ROOM_DEFAULT_HEIGHT_M',
  'HOURS_PER_TICK',
  'HOURS_PER_DAY',
  'DAYS_PER_MONTH',
  'MONTHS_PER_YEAR',
  'HOURS_PER_MONTH',
  'HOURS_PER_YEAR'
]);

/** @type {import('eslint').Rule.RuleModule} */
export const noDuplicateSimConstantsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid redeclaring canonical simulation constants outside simConstants.ts',
      recommended: 'error'
    },
    schema: [],
    messages: {
      duplicate:
        'Simulation constant "{{name}}" must only be declared in {{canonicalPath}}.'
    }
  },
  create(context) {
    const filename = context.getFilename();

    if (!filename || filename === '<input>') {
      return {};
    }

    const normalizedFilename = path.normalize(filename);
    const isCanonicalFile = normalizedFilename === CANONICAL_ABSOLUTE_PATH;

    return {
      VariableDeclarator(node) {
        if (isCanonicalFile) {
          return;
        }

        if (node.id.type !== 'Identifier') {
          return;
        }

        const identifierName = node.id.name;

        if (!CANONICAL_CONSTANT_NAMES.has(identifierName)) {
          return;
        }

        context.report({
          node: node.id,
          messageId: 'duplicate',
          data: {
            name: identifierName,
            canonicalPath: CANONICAL_RELATIVE_PATH
          }
        });
      }
    };
  }
};
