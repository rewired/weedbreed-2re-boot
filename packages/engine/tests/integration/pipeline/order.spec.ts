import { describe, expect, it } from 'vitest';

import { createRecordingContext, runOneTickWithTrace } from '@/backend/src/engine/testHarness.js';
import type { StepName } from '@/backend/src/engine/trace.js';

const EXPECTED_STAGE_ORDER = [
  'applyDeviceEffects',
  'applySensors',
  'updateEnvironment',
  'applyIrrigationAndNutrients',
  'applyWorkforce',
  'advancePhysiology',
  'applyHarvestAndInventory',
  'applyEconomyAccrual',
  'commitAndTelemetry'
] as const;

describe('Engine pipeline — order trace', () => {
  it('executes exactly the 9 SEC §4.2 phases in canonical order', () => {
    const { trace } = runOneTickWithTrace();
    const stageNames = trace.steps.map((step) => step.name);

    expect(stageNames).toEqual(EXPECTED_STAGE_ORDER);
    expect(stageNames).toHaveLength(EXPECTED_STAGE_ORDER.length);
    expect(new Set(stageNames).size).toBe(EXPECTED_STAGE_ORDER.length);
  });

  it('invokes stage instrumentation hooks in canonical order', () => {
    const recorded: StepName[] = [];
    const { trace } = runOneTickWithTrace({
      context: createRecordingContext(recorded)
    });
    const stageNames = trace.steps.map((step) => step.name);

    expect(recorded).toEqual(EXPECTED_STAGE_ORDER);
    expect(stageNames).toEqual(EXPECTED_STAGE_ORDER);
  });
});
