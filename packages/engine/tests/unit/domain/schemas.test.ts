import { describe, expect, it } from 'vitest';
import {
  companySchema,
  parseCompanyWorld,
  type DevicePlacementScope,
  type ParsedCompanyWorld
} from '@wb/engine';

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
                  slug: 'zone-device',
                  name: 'Zone Device',
                  blueprintId: '00000000-0000-0000-0000-000000000061',
                  placementScope: 'zone',
                  quality01: 0.98,
                  condition01: 0.97,
                  powerDraw_W: 450,
                  dutyCycle01: 1,
                  efficiency01: 0.9,
                  sensibleHeatRemovalCapacity_W: 0
                }
              ]
            }
          ],
          devices: [
            {
              id: '00000000-0000-0000-0000-000000000070',
              slug: 'room-device',
              name: 'Room Device',
              blueprintId: '00000000-0000-0000-0000-000000000071',
              placementScope: 'room',
              quality01: 0.92,
              condition01: 0.91,
              powerDraw_W: 320,
              dutyCycle01: 1,
              efficiency01: 0.85,
              sensibleHeatRemovalCapacity_W: 0
            }
          ]
        }
      ],
      devices: [
        {
          id: '00000000-0000-0000-0000-000000000080',
          slug: 'structure-device',
          name: 'Structure Device',
          blueprintId: '00000000-0000-0000-0000-000000000081',
          placementScope: 'structure',
          quality01: 0.93,
          condition01: 0.9,
          powerDraw_W: 500,
          dutyCycle01: 1,
          efficiency01: 0.88,
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
});
