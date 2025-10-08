/* eslint-disable wb-sim/no-economy-per-tick */
import { parser as typescriptEslintParser } from 'typescript-eslint';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import { noEconomyPerTickRule } from '../../../../../tools/eslint/rules/no-economy-per-tick';

const linter = new Linter({ configType: 'eslintrc' });
linter.defineParser(
  '@typescript-eslint/parser',
  typescriptEslintParser as unknown as Linter.ParserModule
);
linter.defineRule('wb-sim/no-economy-per-tick', noEconomyPerTickRule);

function lint(code: string) {
  const messages = linter.verify(
    code,
    {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      rules: {
        'wb-sim/no-economy-per-tick': 'error'
      }
    },
    { filename: 'packages/engine/src/economy/example.ts' }
  );

  return messages.map((message) => ({ ruleId: message.ruleId, message: message.message }));
}

describe('no-economy-per-tick ESLint rule', () => {
  it('flags monetary *_per_tick identifiers', async () => {
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

  it('allows physical *_per_tick identifiers', async () => {
    const messages = lint(`
      const co2Pulse = { pulse_ppm_per_tick: 120 };
      const humidity = zone.humidity_change_per_tick;
    `);

    expect(messages).toHaveLength(0);
  });
});
