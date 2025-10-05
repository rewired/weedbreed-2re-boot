import type { Uuid } from '../entities.js';

export interface HiringMarketScanIntent {
  readonly type: 'hiring.market.scan';
  readonly structureId: Uuid;
}

export interface HiringMarketCandidateRef {
  readonly structureId: Uuid;
  readonly candidateId: Uuid;
}

export interface HiringMarketHireIntent {
  readonly type: 'hiring.market.hire';
  readonly candidate: HiringMarketCandidateRef;
}

export type WorkforceIntent = HiringMarketScanIntent | HiringMarketHireIntent;
