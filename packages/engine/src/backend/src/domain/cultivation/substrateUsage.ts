import { convertSubstrateVolumeLToMassKg } from '../blueprints/substrateBlueprint.js';
import type { SubstratePhysicalProfile } from '../blueprints/substrateBlueprint.js';

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value <= 0) {
    throw new Error(`${name} must be greater than zero.`);
  }
}

function clamp01(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value < 0 || value > 1) {
    throw new Error(`${name} must lie within [0,1].`);
  }

  return value;
}

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
  const fillFraction = clamp01(profile.fillFraction01, 1, 'fillFraction01');
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
