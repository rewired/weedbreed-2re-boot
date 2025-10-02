import { describe, expect, it } from 'vitest';

import {
  AREA_QUANTUM_M2,
  ROOM_DEFAULT_HEIGHT_M,
  DEFAULT_COMPANY_LOCATION_LON,
  DEFAULT_COMPANY_LOCATION_LAT,
  DEFAULT_COMPANY_LOCATION_CITY,
  DEFAULT_COMPANY_LOCATION_COUNTRY
} from '@/backend/src/constants/simConstants.js';
import {
  type Company,
  type PhotoperiodPhase,
  type PlantLifecycleStage,
  type Room,
  type RoomDeviceInstance,
  type StructureDeviceInstance,
  type Uuid,
  type ZoneDeviceInstance,
  validateCompanyWorld
} from '@/backend/src/domain/world.js';

function uuid(value: string): Uuid {
  return value as Uuid;
}

describe('validateCompanyWorld (integration)', () => {
  it('aggregates violations across nested world nodes', () => {
    const company = buildInvalidCompany();

    const result = validateCompanyWorld(company);

    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(4);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'total room area exceeds structure capacity'
        }),
        expect.objectContaining({
          message: 'total zone area exceeds room capacity'
        }),
        expect.objectContaining({
          message: 'only growrooms may contain zones'
        }),
        expect.objectContaining({
          message: 'onHours + offHours must equal 24 hours'
        }),
        expect.objectContaining({
          message: 'plant lifecycle stage is invalid'
        }),
        expect.objectContaining({
          message:
            'room purpose must be one of: growroom, breakroom, laboratory, storageroom, salesroom, workshop'
        })
      ])
    );
  });
});

function buildInvalidCompany(): Company {
  const invalidStructureDeviceScope =
    'room' as unknown as StructureDeviceInstance['placementScope'];
  const invalidZoneDeviceScope =
    'room' as unknown as ZoneDeviceInstance['placementScope'];
  const invalidPhotoperiodPhase = 'veg' as unknown as PhotoperiodPhase;
  const invalidLifecycleStage = 'clone' as unknown as PlantLifecycleStage;

  const invalidCompany: Company = {
    id: uuid('10000000-0000-0000-0000-000000000001'),
    slug: 'invalid-company',
    name: 'Invalid Company',
    location: {
      lon: DEFAULT_COMPANY_LOCATION_LON,
      lat: DEFAULT_COMPANY_LOCATION_LAT,
      cityName: DEFAULT_COMPANY_LOCATION_CITY,
      countryName: DEFAULT_COMPANY_LOCATION_COUNTRY
    },
    structures: [
      {
        id: uuid('10000000-0000-0000-0000-000000000010'),
        slug: 'structure-small',
        name: 'Structure Small',
        floorArea_m2: AREA_QUANTUM_M2 * 2,
        height_m: ROOM_DEFAULT_HEIGHT_M,
        devices: [
          {
            id: uuid('10000000-0000-0000-0000-000000000011'),
            slug: 'bad-structure-device',
            name: 'Bad Structure Device',
            blueprintId: uuid('10000000-0000-0000-0000-000000000012'),
            placementScope: invalidStructureDeviceScope,
            quality01: 1.2,
            condition01: -0.2,
            powerDraw_W: -150,
            dutyCycle01: 1.1,
            efficiency01: -0.1,
            sensibleHeatRemovalCapacity_W: -10
          }
        ],
        rooms: [
          {
            id: uuid('10000000-0000-0000-0000-000000000020'),
            slug: 'growroom-overfilled',
            name: 'Growroom Overfilled',
            purpose: 'growroom',
            floorArea_m2: AREA_QUANTUM_M2 * 2,
            height_m: 0,
            devices: [],
            zones: [
              {
                id: uuid('10000000-0000-0000-0000-000000000021'),
                slug: 'oversized-zone',
                name: 'Oversized Zone',
                floorArea_m2: AREA_QUANTUM_M2 * 4,
                height_m: -1,
                cultivationMethodId: uuid(''),
                irrigationMethodId: uuid('10000000-0000-0000-0000-000000000022'),
                containerId: uuid(''),
                substrateId: uuid(''),
                lightSchedule: { onHours: 20, offHours: 5, startHour: 24 },
                photoperiodPhase: invalidPhotoperiodPhase,
                environment: {
                  airTemperatureC: Number.NaN
                },
                devices: [
                  {
                    id: uuid('10000000-0000-0000-0000-000000000023'),
                    slug: 'zone-device-bad',
                    name: 'Zone Device Bad',
                    blueprintId: uuid('10000000-0000-0000-0000-000000000024'),
                    placementScope: invalidZoneDeviceScope,
                    quality01: 2,
                    condition01: -1,
                    powerDraw_W: -50,
                    dutyCycle01: -0.5,
                    efficiency01: 1.5,
                    sensibleHeatRemovalCapacity_W: -5
                  }
                ],
                plants: [
                  {
                    id: uuid('10000000-0000-0000-0000-000000000025'),
                    slug: 'plant-invalid',
                    name: 'Plant Invalid',
                    strainId: uuid('10000000-0000-0000-0000-000000000026'),
                    lifecycleStage: invalidLifecycleStage,
                    ageHours: -5,
                    health01: 1.5,
                    biomass_g: -10,
                    containerId: uuid(''),
                    substrateId: uuid('')
                  }
                ]
              }
            ]
          },
          {
            id: uuid('10000000-0000-0000-0000-000000000030'),
            slug: 'lab-with-zone',
            name: 'Lab With Zone',
            purpose: 'laboratory',
            floorArea_m2: AREA_QUANTUM_M2 * 2,
            height_m: ROOM_DEFAULT_HEIGHT_M,
            devices: [
              {
                id: uuid('10000000-0000-0000-0000-000000000031'),
                slug: 'lab-device',
                name: 'Lab Device',
                blueprintId: uuid('10000000-0000-0000-0000-000000000032'),
                placementScope:
                  'zone' as unknown as RoomDeviceInstance['placementScope'],
                quality01: 0.5,
                condition01: 0.5,
                powerDraw_W: 100
              }
            ],
            zones: [
              {
                id: uuid('10000000-0000-0000-0000-000000000033'),
                slug: 'lab-zone',
                name: 'Lab Zone',
                floorArea_m2: AREA_QUANTUM_M2,
                height_m: ROOM_DEFAULT_HEIGHT_M,
                cultivationMethodId: uuid('10000000-0000-0000-0000-000000000034'),
                irrigationMethodId: uuid('10000000-0000-0000-0000-000000000035'),
                containerId: uuid('10000000-0000-0000-0000-000000000036'),
                substrateId: uuid('10000000-0000-0000-0000-000000000037'),
                lightSchedule: { onHours: 12, offHours: 12, startHour: 0 },
                photoperiodPhase: 'vegetative',
                devices: [],
                plants: [],
                environment: {
                  airTemperatureC: 21
                }
              }
            ]
          },
          {
            id: uuid('10000000-0000-0000-0000-000000000040'),
            slug: 'mystery-room',
            name: 'Mystery Room',
            purpose: 'hangar' as unknown as Room['purpose'],
            floorArea_m2: AREA_QUANTUM_M2,
            height_m: ROOM_DEFAULT_HEIGHT_M,
            devices: [],
            zones: []
          }
        ]
      }
    ]
  };

  return invalidCompany;
}
