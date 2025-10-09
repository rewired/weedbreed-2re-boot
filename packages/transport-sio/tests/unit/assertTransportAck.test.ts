import { describe, expect, it } from 'vitest';
import { SOCKET_ERROR_CODES, assertTransportAck } from '../../src/index.ts';

describe('assertTransportAck', () => {
  it('accepts a successful acknowledgement', () => {
    expect(() => {
      assertTransportAck({ ok: true });
    }).not.toThrow();
  });

  it('accepts a failed acknowledgement with a known error code', () => {
    expect(() => {
      assertTransportAck({
        ok: false,
        error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: 'Intent payload rejected.' }
      });
    }).not.toThrow();
  });

  it('rejects acknowledgements that omit the ok flag', () => {
    expect(() => {
      assertTransportAck({});
    }).toThrow(/boolean ok flag/);
  });

  it('rejects acknowledgements with extraneous error data on success', () => {
    expect(() => {
      assertTransportAck({
        ok: true,
        error: { code: SOCKET_ERROR_CODES.INTENT_INVALID, message: 'noop' }
      });
    }).toThrow(/must not include an error/);
  });

  it('rejects failed acknowledgements with unknown error codes', () => {
    expect(() => {
      assertTransportAck({ ok: false, error: { code: 'UNKNOWN', message: 'Nope' } });
    }).toThrow(/valid error payload/);
  });
});
