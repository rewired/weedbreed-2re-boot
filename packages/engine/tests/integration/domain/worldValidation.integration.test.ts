import { describe, expect, it } from 'vitest';

import {
  AREA_QUANTUM_M2,
  ROOM_DEFAULT_HEIGHT_M
} from '@/backend/src/constants/simConstants.js';
import { type Company, validateCompanyWorld } from '@/backend/src/domain/world.js';

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
        })
      ])
    );
  });
});

function buildInvalidCompany(): Company {
  return {
    id: '10000000-0000-0000-0000-000000000001' as any,
    slug: 'invalid-company',
    name: 'Invalid Company',
    structures: [
      {
        id: '10000000-0000-0000-0000-000000000010' as any,
        slug: 'structure-small',
        name: 'Structure Small',
        floorArea_m2: AREA_QUANTUM_M2 * 2,
        height_m: ROOM_DEFAULT_HEIGHT_M,
        devices: [
          {
            id: '10000000-0000-0000-0000-000000000011' as any,
            slug: 'bad-structure-device',
            name: 'Bad Structure Device',
            blueprintId: '10000000-0000-0000-0000-000000000012' as any,
            placementScope: 'room' as any,
            quality01: 1.2,
            condition01: -0.2,
            powerDraw_W: -150
          }
        ],
        rooms: [
          {
            id: '10000000-0000-0000-0000-000000000020' as any,
            slug: 'growroom-overfilled',
            name: 'Growroom Overfilled',
            purpose: 'growroom',
            floorArea_m2: AREA_QUANTUM_M2 * 2,
            height_m: 0,
            devices: [],
            zones: [
              {
                id: '10000000-0000-0000-0000-000000000021' as any,
                slug: 'oversized-zone',
                name: 'Oversized Zone',
                floorArea_m2: AREA_QUANTUM_M2 * 4,
                height_m: -1,
                cultivationMethodId: '' as any,
                irrigationMethodId: '10000000-0000-0000-0000-000000000022' as any,
                containerId: '' as any,
                substrateId: '' as any,
                lightSchedule: { onHours: 20, offHours: 5, startHour: 24 },
                photoperiodPhase: 'veg' as any,
                devices: [
                  {
                    id: '10000000-0000-0000-0000-000000000023' as any,
                    slug: 'zone-device-bad',
                    name: 'Zone Device Bad',
                    blueprintId: '10000000-0000-0000-0000-000000000024' as any,
                    placementScope: 'room' as any,
                    quality01: 2,
                    condition01: -1,
                    powerDraw_W: -50
                  }
                ],
                plants: [
                  {
                    id: '10000000-0000-0000-0000-000000000025' as any,
                    slug: 'plant-invalid',
                    name: 'Plant Invalid',
                    strainId: '10000000-0000-0000-0000-000000000026' as any,
                    lifecycleStage: 'clone' as any,
                    ageHours: -5,
                    health01: 1.5,
                    biomass_g: -10,
                    containerId: '' as any,
                    substrateId: '' as any
                  }
                ]
              }
            ]
          },
          {
            id: '10000000-0000-0000-0000-000000000030' as any,
            slug: 'lab-with-zone',
            name: 'Lab With Zone',
            purpose: 'laboratory',
            floorArea_m2: AREA_QUANTUM_M2 * 2,
            height_m: ROOM_DEFAULT_HEIGHT_M,
            devices: [
              {
                id: '10000000-0000-0000-0000-000000000031' as any,
                slug: 'lab-device',
                name: 'Lab Device',
                blueprintId: '10000000-0000-0000-0000-000000000032' as any,
                placementScope: 'zone' as any,
                quality01: 0.5,
                condition01: 0.5,
                powerDraw_W: 100
              }
            ],
            zones: [
              {
                id: '10000000-0000-0000-0000-000000000033' as any,
                slug: 'lab-zone',
                name: 'Lab Zone',
                floorArea_m2: AREA_QUANTUM_M2,
                height_m: ROOM_DEFAULT_HEIGHT_M,
                cultivationMethodId: '10000000-0000-0000-0000-000000000034' as any,
                irrigationMethodId: '10000000-0000-0000-0000-000000000035' as any,
                containerId: '10000000-0000-0000-0000-000000000036' as any,
                substrateId: '10000000-0000-0000-0000-000000000037' as any,
                lightSchedule: { onHours: 12, offHours: 12, startHour: 0 },
                photoperiodPhase: 'vegetative',
                devices: [],
                plants: []
              }
            ]
          }
        ]
      }
    ]
  } as unknown as Company;
}
