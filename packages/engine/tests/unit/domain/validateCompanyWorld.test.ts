import { describe, expect, it } from 'vitest';

import {
  AIR_DENSITY_KG_PER_M3,
  AREA_QUANTUM_M2,
  ROOM_DEFAULT_HEIGHT_M,
  DEFAULT_COMPANY_LOCATION_LON,
  DEFAULT_COMPANY_LOCATION_LAT,
  DEFAULT_COMPANY_LOCATION_CITY,
  DEFAULT_COMPANY_LOCATION_COUNTRY
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

  it('rejects companies missing location metadata', () => {
    const company = withCompanyOverride(createCompany(), (current) => {
      const clone: Company = { ...current };
      Reflect.deleteProperty(clone, 'location');
      return clone;
    });

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'company.location',
        message: 'company must define a location'
      })
    );
  });

  it('rejects longitude coordinates outside the allowed range', () => {
    const company = withCompanyOverride(createCompany(), (current) => ({
      ...current,
      location: { ...current.location, lon: 181 }
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'company.location.lon',
        message: 'longitude must lie within [-180, 180]'
      })
    );
  });

  it('rejects latitude coordinates outside the allowed range', () => {
    const company = withCompanyOverride(createCompany(), (current) => ({
      ...current,
      location: { ...current.location, lat: -91 }
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'company.location.lat',
        message: 'latitude must lie within [-90, 90]'
      })
    );
  });

  it('rejects location coordinates that are not finite numbers', () => {
    const company = withCompanyOverride(createCompany(), (current) => ({
      ...current,
      location: {
        ...current.location,
        lon: Number.NaN,
        lat: Number.POSITIVE_INFINITY
      }
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'company.location.lon',
          message: 'longitude must be a finite number'
        }),
        expect.objectContaining({
          path: 'company.location.lat',
          message: 'latitude must be a finite number'
        })
      ])
    );
  });

  it('rejects empty city or country metadata', () => {
    const company = withCompanyOverride(createCompany(), (current) => ({
      ...current,
      location: { ...current.location, cityName: '', countryName: '   ' }
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'company.location.cityName',
          message: 'city name must not be empty'
        }),
        expect.objectContaining({
          path: 'company.location.countryName',
          message: 'country name must not be empty'
        })
      ])
    );
  });

  it('accepts locations located on boundary coordinates', () => {
    const company = withCompanyOverride(createCompany(), (current) => ({
      ...current,
      location: { ...current.location, lon: -180, lat: -90 }
    }));

    let result = validateCompanyWorld(company);

    expect(result.ok).toBe(true);

    const secondCompany = withCompanyOverride(company, (current) => ({
      ...current,
      location: { ...current.location, lon: 180, lat: 90 }
    }));

    result = validateCompanyWorld(secondCompany);

    expect(result.ok).toBe(true);
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

  it('rejects rooms whose purpose is unsupported', () => {
    const company = withRoomOverride(createCompany(), (room) => ({
      ...room,
      purpose: 'moonbase' as unknown as Room['purpose']
    }));

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'company.structures[0].rooms[0].purpose',
        message:
          'room purpose must be one of: growroom, breakroom, laboratory, storageroom, salesroom, workshop'
      })
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

function withCompanyOverride(
  company: Company,
  update: (company: Company) => Company
): Company {
  const draft: Company = { ...company };
  return update(draft);
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
    powerDraw_W: 480,
    dutyCycle01: 1,
    efficiency01: 0.85,
    sensibleHeatRemovalCapacity_W: 0
  } satisfies ZoneDeviceInstance;

  const zone: Zone = {
    id: uuid('00000000-0000-0000-0000-000000000060'),
    slug: 'veg-zone',
    name: 'Vegetative Zone',
    floorArea_m2: AREA_QUANTUM_M2 * 8,
    height_m: ROOM_DEFAULT_HEIGHT_M,
    airMass_kg: AREA_QUANTUM_M2 * 8 * ROOM_DEFAULT_HEIGHT_M * AIR_DENSITY_KG_PER_M3,
    cultivationMethodId: uuid('00000000-0000-0000-0000-000000000061'),
    irrigationMethodId: uuid('00000000-0000-0000-0000-000000000062'),
    containerId: plant.containerId,
    substrateId: plant.substrateId,
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [plant],
    devices: [zoneDevice],
    environment: {
      airTemperatureC: 22
    }
  } satisfies Zone;

  const roomDevice: RoomDeviceInstance = {
    id: uuid('00000000-0000-0000-0000-000000000070'),
    slug: 'room-dehumidifier',
    name: 'Room Dehumidifier',
    blueprintId: uuid('00000000-0000-0000-0000-000000000071'),
    placementScope: 'room',
    quality01: 0.85,
    condition01: 0.9,
    powerDraw_W: 250,
    dutyCycle01: 1,
    efficiency01: 0.8,
    sensibleHeatRemovalCapacity_W: 0
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
    powerDraw_W: 3_500,
    dutyCycle01: 1,
    efficiency01: 0.9,
    sensibleHeatRemovalCapacity_W: 0
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
    location: {
      lon: DEFAULT_COMPANY_LOCATION_LON,
      lat: DEFAULT_COMPANY_LOCATION_LAT,
      cityName: DEFAULT_COMPANY_LOCATION_CITY,
      countryName: DEFAULT_COMPANY_LOCATION_COUNTRY
    },
    structures: [structure]
  } satisfies Company;
}
