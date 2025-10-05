export interface WorkforceMarketScanConfig {
  readonly scanCooldown_days: number;
  readonly poolSize: number;
  readonly scanCost_cc: number;
}

export interface WorkforceConfig {
  readonly market: WorkforceMarketScanConfig;
}

export const DEFAULT_WORKFORCE_CONFIG: WorkforceConfig = {
  market: {
    scanCooldown_days: 30,
    poolSize: 16,
    scanCost_cc: 1000,
  },
} as const;
