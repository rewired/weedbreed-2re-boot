import { describe, expect, it } from 'vitest';

import {
  evaluatePestDiseaseRisk,
  resolveRiskLevel,
  PEST_DISEASE_RISK_LEVEL_THRESHOLDS,
} from '@/backend/src/health/pestDiseaseRisk';

const IDEAL_ENVIRONMENT = {
  airTemperatureC: 23,
  relativeHumidity01: 0.55,
  co2_ppm: 400,
} as const;

describe('pest & disease risk evaluation', () => {
  it('returns zero risk when environment and hygiene are ideal', () => {
    const result = evaluatePestDiseaseRisk({
      environment: IDEAL_ENVIRONMENT,
      hygieneScore01: 1,
      previousRisk01: 0,
      isQuarantined: false,
    });

    expect(result.risk01).toBe(0);
    expect(resolveRiskLevel(result.risk01)).toBe('low');
  });

  it('escalates risk with poor humidity and hygiene signals', () => {
    const result = evaluatePestDiseaseRisk({
      environment: {
        airTemperatureC: 30,
        relativeHumidity01: 0.85,
        co2_ppm: 400,
      },
      hygieneScore01: 0.3,
      previousRisk01: 0.1,
      isQuarantined: false,
    });

    expect(result.risk01).toBeGreaterThan(PEST_DISEASE_RISK_LEVEL_THRESHOLDS.moderate);
    expect(resolveRiskLevel(result.risk01)).toBe('high');
  });

  it('applies additional decay when the zone is quarantined', () => {
    const activeRisk = evaluatePestDiseaseRisk({
      environment: {
        airTemperatureC: 28,
        relativeHumidity01: 0.75,
        co2_ppm: 400,
      },
      hygieneScore01: 0.6,
      previousRisk01: 0.8,
      isQuarantined: false,
    });

    const quarantinedRisk = evaluatePestDiseaseRisk({
      environment: {
        airTemperatureC: 24,
        relativeHumidity01: 0.5,
        co2_ppm: 400,
      },
      hygieneScore01: 0.9,
      previousRisk01: activeRisk.risk01,
      isQuarantined: true,
    });

    expect(quarantinedRisk.risk01).toBeLessThan(activeRisk.risk01);
    const levelRank = { low: 0, moderate: 1, high: 2 } as const;
    const baselineLevel = resolveRiskLevel(activeRisk.risk01);
    const quarantinedLevel = resolveRiskLevel(quarantinedRisk.risk01);
    expect(levelRank[quarantinedLevel]).toBeLessThanOrEqual(levelRank[baselineLevel]);
  });
});
