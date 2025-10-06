import type {
  HiringMarketCandidateRef,
  HiringMarketHireIntent,
  HiringMarketScanIntent,
  Uuid,
} from '@wb/engine';

export function createHiringMarketScanIntent(structureId: Uuid): HiringMarketScanIntent {
  if (!structureId) {
    throw new Error('structureId must be provided');
  }

  return {
    type: 'hiring.market.scan',
    structureId,
  } satisfies HiringMarketScanIntent;
}

export function createHiringMarketHireIntent(
  candidate: HiringMarketCandidateRef | null | undefined,
): HiringMarketHireIntent {
  if (!candidate) {
    throw new Error('candidate must include structureId and candidateId');
  }

  const { structureId, candidateId } = candidate;

  if (!structureId || !candidateId) {
    throw new Error('candidate must include structureId and candidateId');
  }

  return {
    type: 'hiring.market.hire',
    candidate,
  } satisfies HiringMarketHireIntent;
}
