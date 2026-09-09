import { createHash } from 'node:crypto';

import {
  EPS_ABS as SIM_EPS_ABS,
  EPS_REL as SIM_EPS_REL,
  HASH_KEY_BYTES,
  HASH_TRUNC_BYTES,
} from '../../../constants/simConstants.ts';
import { canonicalStringifyStateHash } from '../../../util/canonicalStateHash.ts';

import type { DailyRecord, DailyRecordBase, ScenarioSummary } from '../types.ts';

export const EPS_ABS = SIM_EPS_ABS;
export const EPS_REL = SIM_EPS_REL;

export function recordDailyHash(payload: DailyRecordBase): string {
  const canonical = canonicalStringifyStateHash(payload);
  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, HASH_KEY_BYTES);
}

export function computeSummaryHash(
  summary: Omit<ScenarioSummary, 'hash'>,
  daily: readonly DailyRecord[]
): string {
  const canonical = canonicalStringifyStateHash({ summary, daily });
  return createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, HASH_TRUNC_BYTES);
}
