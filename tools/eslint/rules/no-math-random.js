/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const noMathRandomRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow Math.random so deterministic RNG utilities remain the single source of randomness',
      recommended: 'error'
    },
    schema: [],
    messages: {
      forbidden: 'Use the deterministic RNG utilities (e.g. createRng) instead of Math.random.'
    }
  },
  create(context) {
    const isMathIdentifier = (node) => node.type === 'Identifier' && node.name === 'Math';

    const isRandomProperty = (node, computed) => {
      if (!node) {
        return false;
      }

      if (!computed && node.type === 'Identifier') {
        return node.name === 'random';
      }

      if (computed) {
        if (node.type === 'Literal') {
          return node.value === 'random';
        }

        if (node.type === 'TemplateLiteral') {
          return (
            node.expressions.length === 0 &&
            node.quasis.length === 1 &&
            node.quasis[0]?.value?.cooked === 'random'
          );
        }
      }

      return false;
    };

    return {
      MemberExpression(node) {
        if (!isMathIdentifier(node.object)) {
          return;
        }

        if (!isRandomProperty(node.property, node.computed)) {
          return;
        }

        context.report({
          node: node.property,
          messageId: 'forbidden'
        });
      }
    };
  }
};
