import { describe, expect, it } from 'vitest';
import { AIR_DENSITY_KG_PER_M3, ROOM_DEFAULT_HEIGHT_M } from '@/backend/src/constants/simConstants.js';
import {
  companySchema,
  parseCompanyWorld,
  type DevicePlacementScope,
  type DeviceQualityPolicy,
  type ParsedCompanyWorld,
  type Uuid
} from '@wb/engine';
import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint.js';
import { deviceQuality } from '../../testUtils/deviceHelpers.js';

type DeepMutable<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? DeepMutableArray<U>
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

type DeepMutableArray<T> = DeepMutable<T>[];

type MutableCompanyWorld = DeepMutable<ParsedCompanyWorld>;

type MutableZoneDeviceInstance = MutableCompanyWorld['structures'][number]['rooms'][number]['zones'][number]['devices'][number] & {
  placementScope: DevicePlacementScope;
};

const QUALITY_POLICY: DeviceQualityPolicy = {
  sampleQuality01: (rng) => rng()
};

const WORLD_SEED = 'schema-world-seed';

const SCHEMA_ZONE_DEVICE_BLUEPRINT: DeviceBlueprint = {
  id: '00000000-0000-0000-0000-000000000061',
  slug: 'zone-device',
  class: 'device.test.zone',
  name: 'Zone Device',
  placementScope: 'zone',
  allowedRoomPurposes: ['growroom'],
  power_W: 450,
  efficiency01: 0.9,
  coverage_m2: 30,
  airflow_m3_per_h: 0
};

const SCHEMA_ROOM_DEVICE_BLUEPRINT: DeviceBlueprint = {
  id: '00000000-0000-0000-0000-000000000071',
  slug: 'room-device',
  class: 'device.test.room',
  name: 'Room Device',
  placementScope: 'room',
  allowedRoomPurposes: ['growroom'],
  power_W: 320,
  efficiency01: 0.85,
  coverage_m2: 0,
  airflow_m3_per_h: 0
};

const SCHEMA_STRUCTURE_DEVICE_BLUEPRINT: DeviceBlueprint = {
  id: '00000000-0000-0000-0000-000000000081',
  slug: 'structure-device',
  class: 'device.test.structure',
  name: 'Structure Device',
  placementScope: 'structure',
  allowedRoomPurposes: ['growroom'],
  power_W: 500,
  efficiency01: 0.88,
  coverage_m2: 0,
  airflow_m3_per_h: 0
};

const BASE_WORLD = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'acme-cultivation',
  name: 'ACME Cultivation',
  location: {
    lon: 9.9937,
    lat: 53.5511,
    cityName: 'Hamburg',
    countryName: 'Deutschland'
  },
  structures: [
    {
      id: '00000000-0000-0000-0000-000000000010',
      slug: 'warehouse-alpha',
      name: 'Warehouse Alpha',
      floorArea_m2: 120,
      height_m: 6,
      rooms: [
        {
          id: '00000000-0000-0000-0000-000000000020',
          slug: 'growroom-alpha',
          name: 'Growroom Alpha',
          floorArea_m2: 60,
          height_m: 3,
          purpose: 'growroom',
          zones: [
            {
              id: '00000000-0000-0000-0000-000000000030',
              slug: 'zone-alpha',
              name: 'Zone Alpha',
              floorArea_m2: 30,
              height_m: 3,
              airMass_kg: 30 * ROOM_DEFAULT_HEIGHT_M * AIR_DENSITY_KG_PER_M3,
              cultivationMethodId: '00000000-0000-0000-0000-000000000040',
              irrigationMethodId: '00000000-0000-0000-0000-000000000041',
              containerId: '00000000-0000-0000-0000-000000000042',
              substrateId: '00000000-0000-0000-0000-000000000043',
              lightSchedule: {
                onHours: 18,
                offHours: 6,
                startHour: 0
              },
              photoperiodPhase: 'vegetative',
              ppfd_umol_m2s: 0,
              dli_mol_m2d_inc: 0,
              environment: {
                airTemperatureC: 22
              },
              plants: [
                {
                  id: '00000000-0000-0000-0000-000000000050',
                  slug: 'plant-alpha',
                  name: 'Plant Alpha',
                  strainId: '00000000-0000-0000-0000-000000000051',
                  lifecycleStage: 'vegetative',
                  ageHours: 72,
                  health01: 0.95,
                  biomass_g: 125,
                  containerId: '00000000-0000-0000-0000-000000000042',
                  substrateId: '00000000-0000-0000-0000-000000000043'
                }
              ],
              devices: [
                {
                  id: '00000000-0000-0000-0000-000000000060',
                  slug: SCHEMA_ZONE_DEVICE_BLUEPRINT.slug,
                  name: SCHEMA_ZONE_DEVICE_BLUEPRINT.name,
                  blueprintId: SCHEMA_ZONE_DEVICE_BLUEPRINT.id,
                  placementScope: 'zone',
                  quality01: deviceQuality(
                    QUALITY_POLICY,
                    WORLD_SEED,
                    '00000000-0000-0000-0000-000000000060' as Uuid,
                    SCHEMA_ZONE_DEVICE_BLUEPRINT
                  ),
                  condition01: 0.97,
                  powerDraw_W: 450,
                  dutyCycle01: 1,
                  efficiency01: 0.9,
                  coverage_m2: 30,
                  airflow_m3_per_h: 0,
                  sensibleHeatRemovalCapacity_W: 0
                }
              ]
            }
          ],
          devices: [
            {
              id: '00000000-0000-0000-0000-000000000070',
              slug: SCHEMA_ROOM_DEVICE_BLUEPRINT.slug,
              name: SCHEMA_ROOM_DEVICE_BLUEPRINT.name,
              blueprintId: SCHEMA_ROOM_DEVICE_BLUEPRINT.id,
              placementScope: 'room',
              quality01: deviceQuality(
                QUALITY_POLICY,
                WORLD_SEED,
                '00000000-0000-0000-0000-000000000070' as Uuid,
                SCHEMA_ROOM_DEVICE_BLUEPRINT
              ),
              condition01: 0.91,
              powerDraw_W: 320,
              dutyCycle01: 1,
              efficiency01: 0.85,
              coverage_m2: 0,
              airflow_m3_per_h: 0,
              sensibleHeatRemovalCapacity_W: 0
            }
          ]
        }
        ],
        devices: [
          {
            id: '00000000-0000-0000-0000-000000000080',
            slug: SCHEMA_STRUCTURE_DEVICE_BLUEPRINT.slug,
            name: SCHEMA_STRUCTURE_DEVICE_BLUEPRINT.name,
            blueprintId: SCHEMA_STRUCTURE_DEVICE_BLUEPRINT.id,
            placementScope: 'structure',
            quality01: deviceQuality(
              QUALITY_POLICY,
              WORLD_SEED,
              '00000000-0000-0000-0000-000000000080' as Uuid,
              SCHEMA_STRUCTURE_DEVICE_BLUEPRINT
            ),
            condition01: 0.9,
            powerDraw_W: 500,
            dutyCycle01: 1,
          efficiency01: 0.88,
          coverage_m2: 0,
          airflow_m3_per_h: 0,
          sensibleHeatRemovalCapacity_W: 0
        }
      ]
    }
  ]
} as const satisfies ParsedCompanyWorld;

const cloneWorld = (): MutableCompanyWorld => structuredClone(BASE_WORLD) as MutableCompanyWorld;

describe('companySchema', () => {
  it('accepts a valid company world payload', () => {
    const result = companySchema.safeParse(cloneWorld());

    expect(result.success).toBe(true);
  });

  it('rejects zones missing a cultivation method identifier', () => {
    const invalidWorld = cloneWorld();
    const targetZone = invalidWorld.structures[0].rooms[0].zones[0];
    Reflect.deleteProperty(targetZone, 'cultivationMethodId');

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'structures',
      0,
      'rooms',
      0,
      'zones',
      0,
      'cultivationMethodId'
    ]);
  });

  it('rejects devices that declare an incorrect placement scope for the zone level', () => {
    const invalidWorld = cloneWorld();
    const targetDevice =
      invalidWorld.structures[0].rooms[0].zones[0].devices[0] as MutableZoneDeviceInstance;
    targetDevice.placementScope = 'room';

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'structures',
      0,
      'rooms',
      0,
      'zones',
      0,
      'devices',
      0,
      'placementScope'
    ]);
  });

  it('accepts light schedules that sum to 24 hours', () => {
    const validWorld = cloneWorld();
    const targetSchedule =
      validWorld.structures[0].rooms[0].zones[0].lightSchedule;
    targetSchedule.onHours = 12;
    targetSchedule.offHours = 12;

    const result = companySchema.safeParse(validWorld);

    expect(result.success).toBe(true);
  });

  it('rejects light schedules that do not cover a full 24-hour cycle', () => {
    const invalidWorld = cloneWorld();
    const targetSchedule =
      invalidWorld.structures[0].rooms[0].zones[0].lightSchedule;
    targetSchedule.onHours = 20;
    targetSchedule.offHours = 3;

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'structures',
      0,
      'rooms',
      0,
      'zones',
      0,
      'lightSchedule'
    ]);
  });

  it('rejects growrooms that omit zones', () => {
    const invalidWorld = cloneWorld();
    const targetRoom = invalidWorld.structures[0].rooms[0];
    targetRoom.zones = [];

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'structures',
      0,
      'rooms',
      0,
      'zones'
    ]);
  });

  it('rejects non-growroom purposes that still contain zones', () => {
    const invalidWorld = cloneWorld();
    const targetRoom = invalidWorld.structures[0].rooms[0];
    targetRoom.purpose = 'laboratory';

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'structures',
      0,
      'rooms',
      0,
      'zones'
    ]);
  });

  it('rejects rooms with harvestLots when purpose is not storageroom', () => {
    const invalidWorld = cloneWorld();
    const targetRoom = invalidWorld.structures[0].rooms[0] as typeof invalidWorld.structures[0]['rooms'][number] & {
      harvestLots?: unknown;
    };
    targetRoom.harvestLots = [
      {
        id: '00000000-0000-0000-0000-000000000999',
        name: 'Invalid Harvest',
        strainId: '00000000-0000-0000-0000-000000000020',
        strainSlug: 'white-widow',
        quality01: 0.8,
        dryWeight_g: 100,
        harvestedAtSimHours: 500,
        sourceZoneId: '00000000-0000-0000-0000-000000000004'
      }
    ];

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('Only storagerooms may contain harvestLots')
        )
      ).toBe(true);
    }
  });

  it('accepts storagerooms with valid harvestLots', () => {
    const validWorld = cloneWorld();
    validWorld.structures[0].rooms.push({
      id: '00000000-0000-0000-0000-000000000888',
      slug: 'storage',
      name: 'Storage Room',
      purpose: 'storageroom',
      floorArea_m2: 40,
      height_m: 3,
      devices: [],
      zones: [],
      harvestLots: [
        {
          id: '00000000-0000-0000-0000-000000000777',
          name: 'Harvest Lot 1',
          strainId: '00000000-0000-0000-0000-000000000020',
          strainSlug: 'white-widow',
          quality01: 0.92,
          dryWeight_g: 850.5,
          harvestedAtSimHours: 1200,
          sourceZoneId: '00000000-0000-0000-0000-000000000004'
        }
      ]
    } as typeof validWorld.structures[0]['rooms'][number]);

    const result = companySchema.safeParse(validWorld);

    expect(result.success).toBe(true);
  });

  it('rejects companies missing location metadata', () => {
    const invalidWorld = cloneWorld();
    Reflect.deleteProperty(invalidWorld, 'location');

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'location'
    ]);
  });

  it('rejects longitude coordinates outside the valid range', () => {
    const invalidWorld = cloneWorld();
    invalidWorld.location.lon = 200;

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'location',
      'lon'
    ]);
  });

  it('rejects latitude coordinates outside the valid range', () => {
    const invalidWorld = cloneWorld();
    invalidWorld.location.lat = -100;

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'location',
      'lat'
    ]);
  });

  it('rejects empty location city names', () => {
    const invalidWorld = cloneWorld();
    invalidWorld.location.cityName = '';

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'location',
      'cityName'
    ]);
  });

  it('rejects empty location country names', () => {
    const invalidWorld = cloneWorld();
    invalidWorld.location.countryName = '';

    const result = companySchema.safeParse(invalidWorld);

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toContainEqual([
      'location',
      'countryName'
    ]);
  });

  it('accepts coordinates located on the boundary values', () => {
    const boundaryWorld = cloneWorld();
    boundaryWorld.location.lon = -180;
    boundaryWorld.location.lat = -90;

    let result = companySchema.safeParse(boundaryWorld);
    expect(result.success).toBe(true);

    boundaryWorld.location.lon = 180;
    boundaryWorld.location.lat = 90;

    result = companySchema.safeParse(boundaryWorld);
    expect(result.success).toBe(true);
  });
});

describe('parseCompanyWorld', () => {
  it('returns typed data when provided with a valid payload', () => {
    const parsed = parseCompanyWorld(cloneWorld());

    expect(parsed.structures[0].rooms[0].zones[0].photoperiodPhase).toBe('vegetative');
  });

  it('derives zone air mass using the provided height when present', () => {
    const rawWorld = structuredClone(BASE_WORLD) as Record<string, unknown>;
    const structures = rawWorld.structures as Record<string, unknown>[];
    const rooms = structures[0].rooms as Record<string, unknown>[];
    const zones = rooms[0].zones as Record<string, unknown>[];
    const zone = zones[0];

    zone.height_m = 4;
    delete zone.airMass_kg;

    const parsed = parseCompanyWorld(rawWorld);
    const parsedZone = parsed.structures[0].rooms[0].zones[0];

    expect(parsedZone.height_m).toBe(4);
    expect(parsedZone.airMass_kg).toBeCloseTo(
      parsedZone.floorArea_m2 * 4 * AIR_DENSITY_KG_PER_M3,
      12
    );
  });

  it('defaults the zone height before deriving air mass when omitted', () => {
    const rawWorld = structuredClone(BASE_WORLD) as Record<string, unknown>;
    const structures = rawWorld.structures as Record<string, unknown>[];
    const rooms = structures[0].rooms as Record<string, unknown>[];
    const zones = rooms[0].zones as Record<string, unknown>[];
    const zone = zones[0];

    delete zone.height_m;
    delete zone.airMass_kg;

    const parsed = parseCompanyWorld(rawWorld);
    const parsedZone = parsed.structures[0].rooms[0].zones[0];

    expect(parsedZone.height_m).toBe(ROOM_DEFAULT_HEIGHT_M);
    expect(parsedZone.airMass_kg).toBeCloseTo(
      parsedZone.floorArea_m2 * ROOM_DEFAULT_HEIGHT_M * AIR_DENSITY_KG_PER_M3,
      12
    );
  });
});
