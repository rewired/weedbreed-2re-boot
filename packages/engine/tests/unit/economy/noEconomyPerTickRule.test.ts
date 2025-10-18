/* eslint-disable wb-sim/no-economy-per-tick */
import { parse as tsParse, parseForESLint as tsParseForESLint } from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { noEconomyPerTickRule } from '../../../../../tools/eslint/rules/no-economy-per-tick';

const linter = new Linter({ configType: 'eslintrc' });

const parserModule: Linter.ParserModule = {
  parse(code, options) {
    return tsParse(code, options);
  },
  parseForESLint(code, options) {
    return tsParseForESLint(code, options);
  },
};
linter.defineParser('@typescript-eslint/parser', parserModule);

const ruleCreate = noEconomyPerTickRule.create;
if (typeof ruleCreate !== 'function') {
  throw new Error('Expected no-economy-per-tick rule to expose a create function');
}

const ruleMeta = typeof noEconomyPerTickRule.meta === 'object' && noEconomyPerTickRule.meta !== null ? noEconomyPerTickRule.meta : undefined;
const ruleModule: Linter.RuleModule = {
  meta: ruleMeta,
  create(context) {
    return ruleCreate(context);
  },
};
linter.defineRule('wb-sim/no-economy-per-tick', ruleModule);

function lint(code: string) {
  const messages = linter.verify(
    code,
    {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      rules: {
        'wb-sim/no-economy-per-tick': 'error',
      },
    },
    { filename: 'packages/engine/src/economy/example.ts' }
  );

  return messages.map((message) => ({ ruleId: message.ruleId, message: message.message }));
}

describe('no-economy-per-tick ESLint rule', () => {
  it('flags monetary *_per_tick identifiers', () => {
    const messages = lint(`
      const maintenanceCost_per_tick = 4;
      const pricing = { energy_cost_per_tick_cc: 2 };
      interface Ledger { wage_per_tick: number }
    `);

    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.ruleId).toBe('wb-sim/no-economy-per-tick');
    }
  });

  it('allows physical *_per_tick identifiers', () => {
    const messages = lint(`
      const co2Pulse = { pulse_ppm_per_tick: 120 };
      const humidity = zone.humidity_change_per_tick;
    `);

    expect(messages).toHaveLength(0);
  });
});
