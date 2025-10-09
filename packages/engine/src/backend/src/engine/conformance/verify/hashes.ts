import { createHash } from 'node:crypto';

import safeStringify from 'safe-stable-stringify';

import {
  EPS_ABS as SIM_EPS_ABS,
  EPS_REL as SIM_EPS_REL,
  HASH_KEY_BYTES,
  HASH_TRUNC_BYTES,
} from '@/backend/src/constants/simConstants';

import type { DailyRecord, DailyRecordBase, ScenarioSummary } from '../types.ts';

export const EPS_ABS = SIM_EPS_ABS;
export const EPS_REL = SIM_EPS_REL;

export function recordDailyHash(payload: DailyRecordBase): string {
  const canonical = safeStringify(payload);
  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, HASH_KEY_BYTES);
}

export function computeSummaryHash(
  summary: Omit<ScenarioSummary, 'hash'>,
  daily: readonly DailyRecord[]
): string {
  const canonical = safeStringify({ summary, daily });
  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, HASH_TRUNC_BYTES);
}
