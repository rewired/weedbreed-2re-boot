import { describe, expect, it } from 'vitest';
import { createSocketTransportDescriptor } from '../../src/index.ts';

describe('createSocketTransportDescriptor', () => {
  it('creates a descriptor with the expected endpoint', () => {
    const TEST_PORT = 1337;
    const descriptor = createSocketTransportDescriptor({ host: '127.0.0.1', port: TEST_PORT });

    expect(descriptor).toEqual({ endpointUrl: `http://127.0.0.1:${String(TEST_PORT)}` });
  });

  it('validates the provided port', () => {
    expect(() => createSocketTransportDescriptor({ host: 'localhost', port: -1 })).toThrow(
      /positive integer port/
    );
  });
});
