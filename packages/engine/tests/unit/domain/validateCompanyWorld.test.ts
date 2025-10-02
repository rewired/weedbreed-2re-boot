import { describe, expect, it } from 'vitest';

import {
  AREA_QUANTUM_M2,
  ROOM_DEFAULT_HEIGHT_M
} from '@/backend/src/constants/simConstants.js';
import {
  type Company,
  type Structure,
  type Room,
  type Zone,
  type Plant,
  type StructureDeviceInstance,
  type RoomDeviceInstance,
  type ZoneDeviceInstance,
  validateCompanyWorld
} from '@/backend/src/domain/world.js';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
    ? Mutable<U>[]
    : Mutable<T[P]>;
};

describe('validateCompanyWorld (unit)', () => {
  it('accepts a world tree that satisfies SEC guardrails', () => {
    const company = createCompany();

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects zones that omit the cultivation method id', () => {
    const company = structuredClone(createCompany()) as Mutable<Company>;
    company.structures[0].rooms[0].zones[0].cultivationMethodId = '' as any;

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('cultivationMethodId')
        })
      ])
    );
  });

  it('rejects rooms with zones outside growrooms', () => {
    const company = structuredClone(createCompany()) as Mutable<Company>;
    company.structures[0].rooms[0].purpose = 'laboratory';

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'only growrooms may contain zones'
        })
      ])
    );
  });

  it('rejects devices whose placement scope conflicts with their host node', () => {
    const company = structuredClone(createCompany()) as Mutable<Company>;
    company.structures[0].rooms[0].devices[0].placementScope = 'structure';

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('placementScope'),
          message: 'device placement scope must be "room"'
        })
      ])
    );
  });
});

function createCompany(): Company {
  const plant: Plant = {
    id: '00000000-0000-0000-0000-000000000010' as any,
    slug: 'strain-alpha',
    name: 'Alpha Plant',
    strainId: '00000000-0000-0000-0000-000000000020' as any,
    lifecycleStage: 'vegetative',
    ageHours: 72,
    health01: 0.92,
    biomass_g: 120,
    containerId: '00000000-0000-0000-0000-000000000030' as any,
    substrateId: '00000000-0000-0000-0000-000000000040' as any
  } satisfies Plant;

  const zoneDevice: ZoneDeviceInstance = {
    id: '00000000-0000-0000-0000-000000000050' as any,
    slug: 'zone-device',
    name: 'Zone Device',
    blueprintId: '00000000-0000-0000-0000-000000000051' as any,
    placementScope: 'zone',
    quality01: 0.8,
    condition01: 0.75,
    powerDraw_W: 480
  } satisfies ZoneDeviceInstance;

  const zone: Zone = {
    id: '00000000-0000-0000-0000-000000000060' as any,
    slug: 'veg-zone',
    name: 'Vegetative Zone',
    floorArea_m2: AREA_QUANTUM_M2 * 8,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    cultivationMethodId: '00000000-0000-0000-0000-000000000061' as any,
    irrigationMethodId: '00000000-0000-0000-0000-000000000062' as any,
    containerId: plant.containerId,
    substrateId: plant.substrateId,
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [plant],
    devices: [zoneDevice]
  } satisfies Zone;

  const roomDevice: RoomDeviceInstance = {
    id: '00000000-0000-0000-0000-000000000070' as any,
    slug: 'room-dehumidifier',
    name: 'Room Dehumidifier',
    blueprintId: '00000000-0000-0000-0000-000000000071' as any,
    placementScope: 'room',
    quality01: 0.85,
    condition01: 0.9,
    powerDraw_W: 250
  } satisfies RoomDeviceInstance;

  const room: Room = {
    id: '00000000-0000-0000-0000-000000000080' as any,
    slug: 'growroom-a',
    name: 'Growroom A',
    purpose: 'growroom',
    floorArea_m2: AREA_QUANTUM_M2 * 16,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    zones: [zone],
    devices: [roomDevice]
  } satisfies Room;

  const structureDevice: StructureDeviceInstance = {
    id: '00000000-0000-0000-0000-000000000090' as any,
    slug: 'structure-hvac',
    name: 'Structure HVAC',
    blueprintId: '00000000-0000-0000-0000-000000000091' as any,
    placementScope: 'structure',
    quality01: 0.95,
    condition01: 0.88,
    powerDraw_W: 3500
  } satisfies StructureDeviceInstance;

  const structure: Structure = {
    id: '00000000-0000-0000-0000-000000000100' as any,
    slug: 'warehouse-north',
    name: 'Warehouse North',
    floorArea_m2: AREA_QUANTUM_M2 * 32,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    rooms: [room],
    devices: [structureDevice]
  } satisfies Structure;

  return {
    id: '00000000-0000-0000-0000-000000000001' as any,
    slug: 'company-alpha',
    name: 'Company Alpha',
    structures: [structure]
  } satisfies Company;
}
