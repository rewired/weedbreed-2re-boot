import { DAYS_PER_MONTH } from '../constants/simConstants.ts';

export interface WorkforceMarketScanConfig {
  readonly scanCooldown_days: number;
  readonly poolSize: number;
  readonly scanCost_cc: number;
}

export interface WorkforceConfig {
  readonly market: WorkforceMarketScanConfig;
}

const DEFAULT_MARKET_POOL_SIZE = 1 << (2 + 2);

export const DEFAULT_WORKFORCE_CONFIG: WorkforceConfig = {
  market: {
    scanCooldown_days: DAYS_PER_MONTH,
    poolSize: DEFAULT_MARKET_POOL_SIZE,
    scanCost_cc: 1000,
  },
} as const;
