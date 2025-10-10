import { describe, expect, it, vi } from 'vitest';

import { emitWorkforceTelemetry } from '@/backend/src/workforce/telemetry/workforceEmit';

const TEST_TOPIC = 'telemetry.test.device_event.v1';

describe('workforce telemetry emitter', () => {
  it('emits cloned payloads for valid device events only', () => {
    const emit = vi.fn();
    const telemetry = { emit };
    const validPayload = { foo: 'bar', nested: { value: 1 } } as const;
    const validEvent = { topic: TEST_TOPIC, payload: validPayload };
    const invalidTopicEvent = { topic: '', payload: validPayload } as unknown as typeof validEvent;
    const invalidPayloadEvent = { topic: TEST_TOPIC, payload: undefined } as unknown as typeof validEvent;

    emitWorkforceTelemetry(telemetry, {
      deviceEvents: [invalidTopicEvent, invalidPayloadEvent, validEvent],
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(TEST_TOPIC, { ...validPayload });
    expect(emit.mock.calls[0][1]).not.toBe(validPayload);

    (validPayload.nested as { value: number }).value = 99;
    expect(emit.mock.calls[0][1]).toStrictEqual({ foo: 'bar', nested: { value: 1 } });
  });

  it('returns early when telemetry bus is undefined', () => {
    expect(() => {
      emitWorkforceTelemetry(undefined, {
        deviceEvents: [
          {
            topic: TEST_TOPIC,
            payload: { foo: 'bar' },
          },
        ],
      });
    }).not.toThrow();
  });
});
