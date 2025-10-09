import { randomUUID } from 'node:crypto';

import type { Plant, Zone, Uuid } from '@/backend/src/domain/entities';
import { AMBIENT_CO2_PPM } from '@/backend/src/constants/simConstants';

export const WHITE_WIDOW_STRAIN_ID = '550e8400-e29b-41d4-a716-446655440001' as Uuid;
export const AK47_STRAIN_ID = '550e8400-e29b-41d4-a716-446655440000' as Uuid;
export const SOUR_DIESEL_STRAIN_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2' as Uuid;
export const NORTHERN_LIGHTS_STRAIN_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7' as Uuid;
export const SKUNK_1_STRAIN_ID = '5a6e9e57-0b3a-4f9f-8f19-12f3f8ec3a0e' as Uuid;

export function createTestPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: (overrides.id ?? randomUUID()) as Plant['id'],
    name: overrides.name ?? 'Test Plant',
    slug: overrides.slug ?? 'test-plant',
    strainId: (overrides.strainId ?? WHITE_WIDOW_STRAIN_ID),
    lifecycleStage: overrides.lifecycleStage ?? 'seedling',
    ageHours: overrides.ageHours ?? 0,
    health01: overrides.health01 ?? 1,
    biomass_g: overrides.biomass_g ?? 1,
    containerId: (overrides.containerId ?? randomUUID()) as Plant['containerId'],
    substrateId: (overrides.substrateId ?? randomUUID()) as Plant['substrateId'],
    ...overrides
  } satisfies Plant;
}

export function createTestZoneWithOptimalConditions(overrides: Partial<Zone> = {}): Zone {
  return {
    id: (overrides.id ?? randomUUID()) as Zone['id'],
    name: overrides.name ?? 'Test Zone',
    slug: overrides.slug ?? 'test-zone',
    floorArea_m2: overrides.floorArea_m2 ?? 20,
    height_m: overrides.height_m ?? 3,
    cultivationMethodId: (overrides.cultivationMethodId ?? randomUUID()) as Zone['cultivationMethodId'],
    irrigationMethodId: (overrides.irrigationMethodId ?? randomUUID()) as Zone['irrigationMethodId'],
    containerId: (overrides.containerId ?? randomUUID()) as Zone['containerId'],
    substrateId: (overrides.substrateId ?? randomUUID()) as Zone['substrateId'],
    lightSchedule:
      overrides.lightSchedule ?? ({ onHours: 18, offHours: 6, startHour: 0 } as Zone['lightSchedule']),
    photoperiodPhase: overrides.photoperiodPhase ?? 'vegetative',
    plants: overrides.plants ?? [],
    devices: overrides.devices ?? [],
    airMass_kg: overrides.airMass_kg ?? 500,
    environment:
      overrides.environment ??
      ({
        airTemperatureC: 23,
        relativeHumidity01: 0.55,
        co2_ppm: AMBIENT_CO2_PPM
      } satisfies Zone['environment']),
    ppfd_umol_m2s: overrides.ppfd_umol_m2s ?? 500,
    dli_mol_m2d_inc: overrides.dli_mol_m2d_inc ?? 0.5,
    nutrientBuffer_mg: overrides.nutrientBuffer_mg ?? {},
    moisture01: overrides.moisture01 ?? 0.5,
    ...overrides
  } satisfies Zone;
}
