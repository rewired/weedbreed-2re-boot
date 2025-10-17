import { describe, expect, it } from 'vitest';

import {
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  TELEMETRY_EVENT,
  assertTransportAck
} from '../src/client.ts';

describe('client entry point', () => {
  it('exposes stable event identifiers and acknowledgement helpers', () => {
    expect(INTENT_EVENT).toBe('intent:submit');
    expect(INTENT_ERROR_EVENT).toBe('intent:error');
    expect(TELEMETRY_EVENT).toBe('telemetry:event');
    expect(TELEMETRY_ERROR_EVENT).toBe('telemetry:error');

    expect(Object.values(SOCKET_ERROR_CODES)).toContain('WB_TEL_READONLY');
  });

  it('provides the transport acknowledgement guard', () => {
    expect(() => {
      assertTransportAck({ ok: true });
    }).not.toThrow();
  });
});
