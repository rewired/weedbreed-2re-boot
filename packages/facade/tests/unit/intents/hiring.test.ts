import { describe, expect, it } from 'vitest';

import {
  createHiringMarketHireIntent,
  createHiringMarketScanIntent,
} from '../../../src/intents/hiring.ts';

describe('hiring intents', () => {
  it('creates a scan intent for the given structure', () => {
    const intent = createHiringMarketScanIntent(
      '00000000-0000-0000-0000-000000000050',
    );

    expect(intent).toEqual({
      type: 'hiring.market.scan',
      structureId: '00000000-0000-0000-0000-000000000050',
    });
  });

  it('creates a hire intent for the given candidate reference', () => {
    const intent = createHiringMarketHireIntent({
      structureId: '00000000-0000-0000-0000-000000000060',
      candidateId: '00000000-0000-0000-0000-000000000061',
    });

    expect(intent).toEqual({
      type: 'hiring.market.hire',
      candidate: {
        structureId: '00000000-0000-0000-0000-000000000060',
        candidateId: '00000000-0000-0000-0000-000000000061',
      },
    });
  });
});
