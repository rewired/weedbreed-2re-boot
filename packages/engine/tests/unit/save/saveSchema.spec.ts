import { describe, expect, it } from 'vitest';

import { saveGameSchema } from '@/backend/src/saveLoad/schemas';

describe('saveGameSchema', () => {
  it('accepts a valid payload', () => {
    const payload = {
      schemaVersion: 1,
      seed: 'seed-123',
      simTime: {
        tick: 42,
        hoursElapsed: 42,
      },
      world: { demo: true },
      metadata: {
        createdAtIso: '2025-01-01T00:00:00.000Z',
        description: 'demo save',
      },
    };

    expect(() => saveGameSchema.parse(payload)).not.toThrow();
  });

  it('rejects payloads without simTime', () => {
    const invalid = {
      schemaVersion: 1,
      seed: 'seed-123',
      world: {},
    };

    expect(() => saveGameSchema.parse(invalid)).toThrowError(/simTime/);
  });
});
