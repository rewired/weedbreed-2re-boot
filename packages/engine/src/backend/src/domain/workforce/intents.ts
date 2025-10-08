import type { Uuid } from '../schemas/primitives.ts';

export interface WorkforceRaiseAcceptIntent {
  readonly type: 'workforce.raise.accept';
  readonly employeeId: Uuid;
  /** Optional custom percentage (0.05 = +5%) applied to the hourly base rate. */
  readonly rateIncreaseFactor?: number;
  /** Optional morale boost override applied after acceptance. */
  readonly moraleBoost01?: number;
}

export interface WorkforceRaiseBonusIntent {
  readonly type: 'workforce.raise.bonus';
  readonly employeeId: Uuid;
  /** Optional lump-sum bonus expressed in company credits for economy hooks. */
  readonly bonusAmount_cc?: number;
  /** Optional custom percentage applied to the hourly base rate. */
  readonly rateIncreaseFactor?: number;
  /** Optional morale boost override applied after the bonus is granted. */
  readonly moraleBoost01?: number;
}

export interface WorkforceRaiseIgnoreIntent {
  readonly type: 'workforce.raise.ignore';
  readonly employeeId: Uuid;
  /** Optional morale penalty override applied when the raise is ignored. */
  readonly moralePenalty01?: number;
}

export type WorkforceRaiseIntent =
  | WorkforceRaiseAcceptIntent
  | WorkforceRaiseBonusIntent
  | WorkforceRaiseIgnoreIntent;

export interface WorkforceTerminationIntent {
  readonly type: 'workforce.employee.terminate';
  readonly employeeId: Uuid;
  readonly reasonSlug?: string;
  readonly severanceCc?: number;
  /** Optional morale ripple applied to peers in the same structure. */
  readonly moraleRipple01?: number;
}

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

export type WorkforceIntent =
  | HiringMarketScanIntent
  | HiringMarketHireIntent
  | WorkforceRaiseIntent
  | WorkforceTerminationIntent;
