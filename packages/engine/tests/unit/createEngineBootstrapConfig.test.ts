import { describe, expect, it } from 'vitest';
import { createEngineBootstrapConfig } from '../../src/index.js';

describe('createEngineBootstrapConfig', () => {
  it('creates a deterministic configuration when provided with a scenario id', () => {
    const config = createEngineBootstrapConfig('demo');

    expect(config).toEqual({
      scenarioId: 'demo',
      verbose: false
    });
  });

  it('throws when the scenario id is missing', () => {
    expect(() => createEngineBootstrapConfig('')).toThrowError(
      /scenarioId must be a non-empty string/
    );
  });
});
