/* eslint-disable wb-sim/no-ts-import-js-extension */

import { describe, expect, it } from 'vitest';
import {
  breedingCrossF1IntentSchema,
  breedingSelectCandidateIntentSchema,
} from '../../../src/intents/breeding/index.js';

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

describe('breeding intent schemas', () => {
  it.each([3, 4, 5] as const)('accepts an F1 population of %i', (populationSize) => {
    expect(breedingCrossF1IntentSchema.parse({
      type: 'breeding.crossF1.v1', intentId: id('1'), laboratoryRoomId: id('2'),
      seedParentId: id('3'), pollenParentId: id('4'), populationSize,
    }).populationSize).toBe(populationSize);
  });

  it('rejects identical parents, out-of-range populations, and extra fields', () => {
    const base = { type: 'breeding.crossF1.v1', intentId: id('1'), laboratoryRoomId: id('2'), seedParentId: id('3'), pollenParentId: id('4') };
    expect(breedingCrossF1IntentSchema.safeParse({ ...base, pollenParentId: id('3'), populationSize: 4 }).success).toBe(false);
    expect(breedingCrossF1IntentSchema.safeParse({ ...base, populationSize: 6 }).success).toBe(false);
    expect(breedingCrossF1IntentSchema.safeParse({ ...base, populationSize: 4, extra: true }).success).toBe(false);
  });

  it('normalises a non-empty selection name', () => {
    const parsed = breedingSelectCandidateIntentSchema.parse({
      type: 'breeding.selectCandidate.v1', intentId: id('5'), runId: id('6'), candidateId: id('7'), name: '  Aurora F1  ',
    });
    expect(parsed.name).toBe('Aurora F1');
    expect(breedingSelectCandidateIntentSchema.safeParse({ ...parsed, name: ' ' }).success).toBe(false);
  });
});
