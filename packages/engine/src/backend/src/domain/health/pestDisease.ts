import type { Uuid } from '../entities.js';

export type PestDiseaseRiskLevel = 'low' | 'moderate' | 'high';

export interface PestDiseaseZoneRiskState {
  readonly zoneId: Uuid;
  readonly roomId: Uuid;
  readonly structureId: Uuid;
  readonly risk01: number;
  readonly riskLevel: PestDiseaseRiskLevel;
  readonly hygieneScore01: number;
  readonly updatedTick: number;
  readonly lastInspectionTick?: number;
  readonly lastTreatmentTick?: number;
  readonly quarantineUntilTick?: number;
}

export interface PestDiseaseHygieneSignal {
  readonly roomId: Uuid;
  readonly hygieneScore01: number;
  readonly updatedTick: number;
}

export interface PestDiseaseSystemState {
  readonly zoneRisks: readonly PestDiseaseZoneRiskState[];
  readonly hygieneSignals: readonly PestDiseaseHygieneSignal[];
}

export interface HealthState {
  readonly pestDisease: PestDiseaseSystemState;
}

export const DEFAULT_HEALTH_STATE: HealthState = {
  pestDisease: {
    zoneRisks: [],
    hygieneSignals: [],
  },
};
