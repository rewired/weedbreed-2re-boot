import { convertSubstrateVolumeLToMassKg } from '../blueprints/substrateBlueprint.ts';
import type { SubstratePhysicalProfile } from '../blueprints/substrateBlueprint.ts';
import { assertPositiveFinite, ensureFraction01 } from '../../util/validation.ts';

export interface ContainerFillProfile {
  readonly substrate: SubstratePhysicalProfile;
  readonly containerVolume_L: number;
  readonly fillFraction01?: number;
}

export interface PlantingBatchProfile extends ContainerFillProfile {
  readonly plantCount: number;
}

export function estimateSubstrateMassPerContainer(profile: ContainerFillProfile): number {
  assertPositiveFinite(profile.containerVolume_L, 'containerVolume_L');
  const fillFraction = ensureFraction01(profile.fillFraction01, 1, 'fillFraction01');
  const filledVolume_L = profile.containerVolume_L * fillFraction;

  return convertSubstrateVolumeLToMassKg(profile.substrate, filledVolume_L);
}

export function estimateSubstrateMassForPlanting(profile: PlantingBatchProfile): number {
  if (!Number.isFinite(profile.plantCount)) {
    throw new Error('plantCount must be a finite number.');
  }

  if (profile.plantCount < 0) {
    throw new Error('plantCount must be non-negative.');
  }

  const massPerContainer = estimateSubstrateMassPerContainer(profile);

  return massPerContainer * profile.plantCount;
}
