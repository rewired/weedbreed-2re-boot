/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const noTsImportJsExtensionRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .js extensions in TypeScript source imports so extensionless paths stay aligned with tsconfig',
      recommended: 'error'
    },
    fixable: 'code',
    schema: [],
    messages: {
      removeJsExtension: 'Remove the `.js` extension when importing TypeScript modules.'
    }
  },
  create(context) {
    const filename = context.getFilename();

    if (!filename || !/\.tsx?$/.test(filename)) {
      return {};
    }

    const isAllowedSpecifier = (value) => {
      if (typeof value !== 'string') {
        return true;
      }

      if (!value.endsWith('.js')) {
        return true;
      }

      return /^(?:https?:|node:|data:|file:)/.test(value);
    };

    const reportLiteral = (literal) => {
      const value = literal.value;

      if (isAllowedSpecifier(value)) {
        return;
      }

      context.report({
        node: literal,
        messageId: 'removeJsExtension',
        fix(fixer) {
          const [start, end] = literal.range ?? [NaN, NaN];

          if (!Number.isFinite(start) || !Number.isFinite(end)) {
            return null;
          }

          // Remove the trailing `.js` segment just before the closing quote.
          return fixer.removeRange([end - 4, end - 1]);
        }
      });
    };

    return {
      ImportDeclaration(node) {
        if (node.source) {
          reportLiteral(node.source);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          reportLiteral(node.source);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          reportLiteral(node.source);
        }
      },
      ImportExpression(node) {
        if (node.source && node.source.type === 'Literal') {
          reportLiteral(node.source);
        }
      }
    };
  }
};
