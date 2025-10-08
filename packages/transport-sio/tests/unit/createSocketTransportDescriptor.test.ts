import { describe, expect, it } from 'vitest';
import { createSocketTransportDescriptor } from '../../src/index.ts';

describe('createSocketTransportDescriptor', () => {
  it('creates a descriptor with the expected endpoint', () => {
    const descriptor = createSocketTransportDescriptor({ host: '127.0.0.1', port: 1337 });

    expect(descriptor).toEqual({ endpointUrl: 'http://127.0.0.1:1337' });
  });

  it('validates the provided port', () => {
    expect(() => createSocketTransportDescriptor({ host: 'localhost', port: -1 })).toThrow(
      /positive integer port/
    );
  });
});
