/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it } from 'vitest';

import {
  createGameNewIntent,
  DEFAULT_DEMO_SEED,
  gameNewIntentSchema,
} from '../../../src/intents/game.js';

describe('game.new.v1 intent', () => {
  it('normalises a valid company name and seed', () => {
    expect(
      createGameNewIntent({
        intentId: 'new-game-1',
        correlationId: 'start-screen-1',
        companyName: '  Emerald Labs  ',
        seed: '  demo-seed  ',
      }),
    ).toEqual({
      type: 'game.new.v1',
      intentId: 'new-game-1',
      correlationId: 'start-screen-1',
      companyName: 'Emerald Labs',
      seed: 'demo-seed',
    });
  });

  it('uses the stable demo seed when the optional seed is omitted', () => {
    expect(
      createGameNewIntent({ intentId: 'new-game-default-seed', companyName: 'Emerald Labs' }),
    ).toMatchObject({ seed: DEFAULT_DEMO_SEED });
  });

  it.each([
    { type: 'game.new.v1', companyName: 'Emerald Labs', seed: 'demo-seed' },
    { type: 'game.new.v1', intentId: 'new-game-1', companyName: ' ', seed: 'demo-seed' },
    { type: 'game.new.v1', intentId: 'new-game-1', companyName: 'Emerald Labs', seed: ' ' },
    { type: 'game.new.v1', intentId: 'new-game-1', companyName: 'Emerald Labs', seed: 'demo', extra: true },
  ])('rejects malformed payload %#', (payload) => {
    expect(() => gameNewIntentSchema.parse(payload)).toThrow();
  });
});
