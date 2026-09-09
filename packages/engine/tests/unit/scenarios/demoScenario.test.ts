import { describe, expect, it } from 'vitest';

import { createDemoScenario } from '@/backend/src/scenarios/demoScenario';
import { hashCanonicalJson } from '@/shared/determinism/hash';

describe('createDemoScenario', () => {
  it('reproduces the same canonical world for the same name and seed', async () => {
    const input = { companyName: 'Green Future', seed: 'journey-seed-42' };
    const first = createDemoScenario(input);
    const second = createDemoScenario(input);

    expect(second).toStrictEqual(first);
    await expect(hashCanonicalJson(second)).resolves.toBe(await hashCanonicalJson(first));
    expect(first.company.name).toBe(input.companyName);
    expect(first.seed).toBe(input.seed);
    expect(first.simTimeHours).toBe(0);
    expect(first.breeding).toStrictEqual({ runs: [], customStrainRegistry: [], qualifiedParents: [] });
  });

  it('changes deterministic identifiers and initial characteristics for another seed', () => {
    const first = createDemoScenario({ companyName: 'Green Future', seed: 'seed-alpha' });
    const second = createDemoScenario({ companyName: 'Green Future', seed: 'seed-beta' });
    const firstZone = first.company.structures[0]?.rooms[0]?.zones[0];
    const secondZone = second.company.structures[0]?.rooms[0]?.zones[0];

    expect(second.id).not.toBe(first.id);
    expect(second.company.id).not.toBe(first.company.id);
    expect(secondZone?.id).not.toBe(firstZone?.id);
    expect(secondZone?.environment).not.toStrictEqual(firstZone?.environment);
  });

  it.each([
    { companyName: '', seed: 'valid' },
    { companyName: 'valid', seed: '   ' },
  ])('rejects an empty company name or seed', (input) => {
    expect(() => createDemoScenario(input)).toThrow(/must be a non-empty string/u);
  });
});
