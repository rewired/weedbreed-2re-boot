import { createHash } from 'node:crypto';

import safeStringify from 'safe-stable-stringify';

import { FLOAT_TOLERANCE } from '@/backend/src/constants/simConstants';

import type { DailyRecord, DailyRecordBase, ScenarioSummary } from '../types.ts';

export const EPS_ABS = FLOAT_TOLERANCE * 1e-3;
export const EPS_REL = FLOAT_TOLERANCE;

export function recordDailyHash(payload: DailyRecordBase): string {
  const canonical = safeStringify(payload);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function computeSummaryHash(
  summary: Omit<ScenarioSummary, 'hash'>,
  daily: readonly DailyRecord[]
): string {
  const canonical = safeStringify({ summary, daily });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}
