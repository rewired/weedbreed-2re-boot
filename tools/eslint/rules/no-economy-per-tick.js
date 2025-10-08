/**
 * ESLint rule preventing monetary fields from using per-tick units.
 * Allows physical process fields (e.g. ppm_per_tick) to remain unaffected.
 * Aligns with SEC §3.6 and DD §? emphasising per-hour units for economy metrics.
 * @type {import('eslint').Rule.RuleModule}
 */
export const noEconomyPerTickRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow *_per_tick identifiers for monetary values; economy fields must use per-hour units.',
      recommended: false
    },
    schema: [],
    messages: {
      monetaryPerTick:
        'Economy identifiers must not use "*_per_tick" units. Use per-hour (or documented SEC units) for monetary values.'
    }
  },
  create(context) {
    const monetaryKeywords = [
      'cost',
      'price',
      'revenue',
      'expense',
      'tariff',
      'wage',
      'salary',
      'payroll',
      'income',
      'cash',
      'credit',
      'cc',
      'fee',
      'tax',
      'bill',
      'rent',
      'charge',
      'payment',
      'payout',
      'upfront'
    ];

    const isMonetaryPerTick = (rawName) => {
      if (!rawName) {
        return false;
      }

      const name = rawName.toLowerCase();

      if (!name.includes('_per_tick')) {
        return false;
      }

      return monetaryKeywords.some((keyword) => name.includes(keyword));
    };

    const reportNode = (node, name) => {
      if (!isMonetaryPerTick(name)) {
        return;
      }

      context.report({
        node,
        messageId: 'monetaryPerTick'
      });
    };

    return {
      Identifier(node) {
        reportNode(node, node.name);
      },
      Literal(node) {
        if (typeof node.value === 'string') {
          reportNode(node, node.value);
        }
      },
      TemplateElement(node) {
        reportNode(node, node.value.raw);
      }
    };
  }
};
