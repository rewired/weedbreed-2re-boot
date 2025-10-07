import { convertSubstrateVolumeLToMassKg } from '../blueprints/substrateBlueprint.js';
import type { SubstratePhysicalProfile } from '../blueprints/substrateBlueprint.js';
import {
  assertPositiveFinite,
  assertNonNegativeFinite,
  ensureFraction01
} from '../../util/validation.js';

export interface IrrigationChargeInput {
  readonly substrate: SubstratePhysicalProfile;
  readonly containerVolume_L: number;
  readonly plantCount: number;
  readonly targetMoistureFraction01: number;
  readonly fillFraction01?: number;
  readonly runoffFraction01?: number;
}

export interface IrrigationChargeEstimate {
  readonly deliveredVolume_L: number;
  readonly absorbedVolume_L: number;
  readonly runoffVolume_L: number;
  readonly absorbedWaterMass_kg: number;
  readonly substrateMass_kg: number;
}

export function estimateIrrigationCharge(input: IrrigationChargeInput): IrrigationChargeEstimate {
  assertPositiveFinite(input.containerVolume_L, 'containerVolume_L');
  assertNonNegativeFinite(input.plantCount, 'plantCount');

  const moistureFraction = ensureFraction01(
    input.targetMoistureFraction01,
    input.targetMoistureFraction01,
    'targetMoistureFraction01'
  );
  const fillFraction = ensureFraction01(input.fillFraction01, 1, 'fillFraction01');
  const runoffFraction = ensureFraction01(input.runoffFraction01, 0, 'runoffFraction01');

  if (runoffFraction >= 1) {
    throw new Error('runoffFraction01 must be less than 1.');
  }

  const substrateVolumePerContainer_L = input.containerVolume_L * fillFraction;
  const substrateMassPerContainer_kg = convertSubstrateVolumeLToMassKg(
    input.substrate,
    substrateVolumePerContainer_L
  );

  const absorbedWaterPerContainer_kg = substrateMassPerContainer_kg * moistureFraction;
  const absorbedVolumePerContainer_L = absorbedWaterPerContainer_kg; // 1 kg water ~= 1 L

  const absorbedVolumeTotal_L = absorbedVolumePerContainer_L * input.plantCount;
  const substrateMassTotal_kg = substrateMassPerContainer_kg * input.plantCount;

  const deliveredVolume_L = absorbedVolumeTotal_L / (1 - runoffFraction);
  const runoffVolume_L = deliveredVolume_L - absorbedVolumeTotal_L;

  return {
    deliveredVolume_L,
    absorbedVolume_L: absorbedVolumeTotal_L,
    runoffVolume_L,
    absorbedWaterMass_kg: absorbedVolumeTotal_L,
    substrateMass_kg: substrateMassTotal_kg
  } satisfies IrrigationChargeEstimate;
}
