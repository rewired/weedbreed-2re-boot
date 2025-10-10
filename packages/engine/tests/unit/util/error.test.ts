import { describe, expect, it } from 'vitest';

import { normaliseUnknownError } from '@/backend/src/util/error';

describe('normaliseUnknownError', () => {
  it('returns the provided error when given an Error instance', () => {
    const original = new Error('sample');

    const normalised = normaliseUnknownError(original, 'fallback');

    expect(normalised).toBe(original);
  });

  it('wraps non-error values with the fallback message', () => {
    const value = { reason: 'nope' };

    const normalised = normaliseUnknownError(value, 'fallback message');

    expect(normalised).toBeInstanceOf(Error);
    expect(normalised.message).toBe('fallback message');
    expect((normalised as Error & { cause?: unknown }).cause).toBe(value);
  });
});
