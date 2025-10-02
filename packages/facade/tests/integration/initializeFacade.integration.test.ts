import { describe, expect, it } from 'vitest';
import { initializeFacade } from '../../src/index.js';

describe('initializeFacade', () => {
  it('composes the engine bootstrap configuration using shared path aliases', () => {
    const result = initializeFacade({ scenarioId: 'integration', verbose: true });

    expect(result.engineConfig).toEqual({
      scenarioId: 'integration',
      verbose: true
    });
  });
});
