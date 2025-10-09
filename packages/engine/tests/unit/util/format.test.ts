import { describe, expect, it } from 'vitest';

import { fmtNum, toStr } from '@/backend/src/util/format';

describe('format helpers', () => {
  it('converts non-string values to strings without mutation', () => {
    expect(toStr('already-string')).toBe('already-string');
    expect(toStr(42)).toBe('42');
  });

  it('formats numbers using canonical string conversion', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(123.456)).toBe('123.456');
  });
});
