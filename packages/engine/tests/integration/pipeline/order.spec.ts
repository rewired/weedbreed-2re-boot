import { describe, expect, it } from 'vitest';

import { PIPELINE_ORDER } from '@/backend/src/engine/Engine.js';
import { createRecordingContext, runOneTickWithTrace } from '@/backend/src/engine/testHarness.js';
import type { StepName } from '@/backend/src/engine/trace.js';

describe('Tick pipeline — SEC §1.5 ordered phases', () => {
  it('executes the canonical pipeline order for a single tick', () => {
    const { trace } = runOneTickWithTrace();
    const stepOrder = trace.steps.map((step) => step.name);

    expect(stepOrder).toEqual(PIPELINE_ORDER);
  });

  it('invokes stage instrumentation hooks in the same order as the trace', () => {
    const recorded: StepName[] = [];
    const { trace } = runOneTickWithTrace({
      context: createRecordingContext(recorded)
    });

    expect(recorded).toEqual(PIPELINE_ORDER);
    expect(trace.steps.map((step) => step.name)).toEqual(recorded);
  });
});
