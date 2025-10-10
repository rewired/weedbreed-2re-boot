import { describe, expect, it } from 'vitest';

import { fmtNum, toStr, formatHumidityDelta, formatTemperatureC } from '@/backend/src/util/format';

describe('format helpers', () => {
  it('converts non-string values to strings without mutation', () => {
    expect(toStr('already-string')).toBe('already-string');
    expect(toStr(42)).toBe('42');
  });

  it('formats numbers using canonical string conversion', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(123.456)).toBe('123.456');
  });

  it('formats temperatures with Celsius units for telemetry outputs', () => {
    expect(formatTemperatureC(21.5)).toBe('21.5 °C');
    expect(formatTemperatureC(Number.NaN)).toBe('NaN °C');
  });

  it('formats humidity deltas with signed percentage units', () => {
    expect(formatHumidityDelta(0.125)).toBe('+12.5 %RH');
    expect(formatHumidityDelta(-0.05)).toBe('-5 %RH');
    expect(formatHumidityDelta(0)).toBe('0 %RH');
    expect(formatHumidityDelta(Number.POSITIVE_INFINITY)).toBe('Infinity %RH');
  });
});
