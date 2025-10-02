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
  type Uuid,
  validateCompanyWorld
} from '@/backend/src/domain/world.js';

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('validateCompanyWorld (unit)', () => {
  it('accepts a world tree that satisfies SEC guardrails', () => {
    const company = createCompany();

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects zones that omit the cultivation method id', () => {
    const company = withZoneOverride(createCompany(), (zone) => ({
      ...zone,
      cultivationMethodId: uuid('')
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((issue) => issue.path.includes('cultivationMethodId'))
    ).toBe(true);
  });

  it('rejects rooms with zones outside growrooms', () => {
    const company = withRoomOverride(createCompany(), (room) => ({
      ...room,
      purpose: 'laboratory'
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      'only growrooms may contain zones'
    );
  });

  it('rejects devices whose placement scope conflicts with their host node', () => {
    const company = withRoomOverride(createCompany(), (room) => ({
      ...room,
      devices: room.devices.map((device, deviceIndex) =>
        deviceIndex === 0
          ? {
              ...device,
              placementScope:
                'structure' as unknown as RoomDeviceInstance['placementScope']
            }
          : device
      )
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      'device placement scope must be "room"'
    );
  });

  it('rejects light schedules that include non-finite values', () => {
    const company = withZoneOverride(createCompany(), (zone) => ({
      ...zone,
      lightSchedule: { onHours: Number.NaN, offHours: 6, startHour: 0 }
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      'onHours must be a finite number'
    );
  });
});

function withStructureOverride(
  company: Company,
  update: (structure: Structure, index: number) => Structure
): Company {
  return {
    ...company,
    structures: company.structures.map((structure, index) =>
      index === 0 ? update(structure, index) : structure
    )
  } satisfies Company;
}

function withRoomOverride(
  company: Company,
  update: (room: Room) => Room
): Company {
  return withStructureOverride(company, (structure, structureIndex) => ({
    ...structure,
    rooms: structure.rooms.map((room, roomIndex) =>
      structureIndex === 0 && roomIndex === 0 ? update(room) : room
    )
  }));
}

function withZoneOverride(
  company: Company,
  update: (zone: Zone) => Zone
): Company {
  return withRoomOverride(company, (room) => ({
    ...room,
    zones: room.zones.map((zone, zoneIndex) =>
      zoneIndex === 0 ? update(zone) : zone
    )
  }));
}

function createCompany(): Company {
  const plant: Plant = {
    id: uuid('00000000-0000-0000-0000-000000000010'),
    slug: 'strain-alpha',
    name: 'Alpha Plant',
    strainId: uuid('00000000-0000-0000-0000-000000000020'),
    lifecycleStage: 'vegetative',
    ageHours: 72,
    health01: 0.92,
    biomass_g: 120,
    containerId: uuid('00000000-0000-0000-0000-000000000030'),
    substrateId: uuid('00000000-0000-0000-0000-000000000040')
  } satisfies Plant;

  const zoneDevice: ZoneDeviceInstance = {
    id: uuid('00000000-0000-0000-0000-000000000050'),
    slug: 'zone-device',
    name: 'Zone Device',
    blueprintId: uuid('00000000-0000-0000-0000-000000000051'),
    placementScope: 'zone',
    quality01: 0.8,
    condition01: 0.75,
    powerDraw_W: 480
  } satisfies ZoneDeviceInstance;

  const zone: Zone = {
    id: uuid('00000000-0000-0000-0000-000000000060'),
    slug: 'veg-zone',
    name: 'Vegetative Zone',
    floorArea_m2: AREA_QUANTUM_M2 * 8,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    cultivationMethodId: uuid('00000000-0000-0000-0000-000000000061'),
    irrigationMethodId: uuid('00000000-0000-0000-0000-000000000062'),
    containerId: plant.containerId,
    substrateId: plant.substrateId,
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [plant],
    devices: [zoneDevice]
  } satisfies Zone;

  const roomDevice: RoomDeviceInstance = {
    id: uuid('00000000-0000-0000-0000-000000000070'),
    slug: 'room-dehumidifier',
    name: 'Room Dehumidifier',
    blueprintId: uuid('00000000-0000-0000-0000-000000000071'),
    placementScope: 'room',
    quality01: 0.85,
    condition01: 0.9,
    powerDraw_W: 250
  } satisfies RoomDeviceInstance;

  const room: Room = {
    id: uuid('00000000-0000-0000-0000-000000000080'),
    slug: 'growroom-a',
    name: 'Growroom A',
    purpose: 'growroom',
    floorArea_m2: AREA_QUANTUM_M2 * 16,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    zones: [zone],
    devices: [roomDevice]
  } satisfies Room;

  const structureDevice: StructureDeviceInstance = {
    id: uuid('00000000-0000-0000-0000-000000000090'),
    slug: 'structure-hvac',
    name: 'Structure HVAC',
    blueprintId: uuid('00000000-0000-0000-0000-000000000091'),
    placementScope: 'structure',
    quality01: 0.95,
    condition01: 0.88,
    powerDraw_W: 3500
  } satisfies StructureDeviceInstance;

  const structure: Structure = {
    id: uuid('00000000-0000-0000-0000-000000000100'),
    slug: 'warehouse-north',
    name: 'Warehouse North',
    floorArea_m2: AREA_QUANTUM_M2 * 32,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    rooms: [room],
    devices: [structureDevice]
  } satisfies Structure;

  return {
    id: uuid('00000000-0000-0000-0000-000000000001'),
    slug: 'company-alpha',
    name: 'Company Alpha',
    structures: [structure]
  } satisfies Company;
}
