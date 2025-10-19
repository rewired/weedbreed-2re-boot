import { COMPANY_TREE_SCHEMA_VERSION, type CompanyTreeReadModel } from '../../src/readModels/api/schemas.ts';

const COMPANY_ID = '00000000-0000-0000-0000-000000000100';
const STRUCTURE_ID = '00000000-0000-0000-0000-000000000101';
const ROOM_ID = '00000000-0000-0000-0000-000000000102';
const ZONE_ID = '00000000-0000-0000-0000-000000000103';
const CULTIVATION_METHOD_ID = '00000000-0000-0000-0000-000000000201';
const CONTAINER_ID = '00000000-0000-0000-0000-000000000202';
const SUBSTRATE_ID = '00000000-0000-0000-0000-000000000203';
const STRAIN_ID = '00000000-0000-0000-0000-000000000204';
const IRRIGATION_ID = '00000000-0000-0000-0000-000000000205';
const DEVICE_ID = '00000000-0000-0000-0000-000000000206';

export const COMPANY_TREE_FIXTURE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 12,
  companyId: COMPANY_ID,
  name: 'Weed Breed GmbH',
  structures: [
    {
      id: STRUCTURE_ID,
      name: 'HQ Campus',
      location: 'Berlin, Germany',
      area_m2: 420,
      volume_m3: 1260,
      capacity: {
        areaUsed_m2: 360,
        areaFree_m2: 60,
        volumeUsed_m3: 1080,
        volumeFree_m3: 180
      },
      coverage: {
        lightingCoverage01: 0.92,
        hvacCapacity01: 0.88,
        airflowAch: 5.6,
        warnings: []
      },
      kpis: {
        energyKwhPerDay: 4200,
        waterM3PerDay: 12.5,
        labourHoursPerDay: 84,
        maintenanceCostPerHour: 58.25
      },
      tariffs: {
        price_electricity: 0.21,
        price_water: 0.04
      },
      devices: [
        {
          id: DEVICE_ID,
          name: 'LumenBar 320',
          slug: 'lighting.lumenbar-320',
          class: 'lighting',
          placementScope: 'zone',
          conditionPercent: 95,
          coverageArea_m2: 32,
          airflow_m3_per_hour: 0,
          powerDraw_kWh_per_hour: 3.2,
          warnings: []
        }
      ],
      rooms: [
        {
          id: ROOM_ID,
          structureId: STRUCTURE_ID,
          name: 'Flower Room',
          purpose: 'growroom',
          area_m2: 120,
          volume_m3: 360,
          capacity: {
            areaUsed_m2: 100,
            areaFree_m2: 20,
            volumeUsed_m3: 300,
            volumeFree_m3: 60
          },
          coverage: {
            achCurrent: 5.1,
            achTarget: 6,
            climateWarnings: []
          },
          climate: {
            snapshot: {
              temperature_C: 24,
              relativeHumidity_percent: 55,
              co2_ppm: 800,
              ach: 5.1,
              notes: 'Aggregated from zone climate snapshots.'
            },
            telemetry: [
              {
                simTimeHours: 12,
                temperature_C: 24,
                relativeHumidity_percent: 55,
                co2_ppm: 800,
                ach: 5.1
              }
            ]
          },
          devices: [],
          zones: [
            {
              id: ZONE_ID,
              name: 'Zone A',
              area_m2: 42,
              volume_m3: 126,
              cultivation: {
                method: {
                  id: CULTIVATION_METHOD_ID,
                  slug: 'sea-of-green',
                  name: 'Sea of Green'
                },
                container: {
                  id: CONTAINER_ID,
                  slug: 'pot-11l',
                  name: '11L Pot',
                  volume_L: 11,
                  serviceLife_cycles: 6,
                  unitCost: 2
                },
                substrate: {
                  id: SUBSTRATE_ID,
                  slug: 'coco-coir',
                  name: 'Coco Coir',
                  unitPrice_per_L: 0.55,
                  densityFactor_L_per_kg: 8.5
                },
                strain: {
                  id: STRAIN_ID,
                  name: 'Unknown strain'
                },
                maxPlants: 72,
                currentPlantCount: 64
              },
              lighting: {
                schedule: {
                  onHours: 18,
                  offHours: 6,
                  startHour: 0
                },
                coveragePercent: 95,
                deviceCount: 12,
                dutyCycle01: 0.75
              },
              irrigation: {
                method: {
                  id: IRRIGATION_ID,
                  slug: 'drip-inline',
                  name: 'Drip Inline',
                  deliveryType: 'drip'
                },
                estimatedWaterDemand_m3_per_day: 0.42,
                labourHoursPerDay: 1.2,
                runoffFraction01: 0.1
              },
              kpis: {
                healthPercent: 96,
                qualityPercent: 92,
                stressPercent: 4,
                biomass_kg: 18.5,
                growthRatePercent: 0
              },
              pestStatus: {
                activeIssues: 0,
                dueInspections: 0,
                upcomingTreatments: 0,
                nextInspectionTick: 144,
                lastInspectionTick: 96
              },
              climate: {
                snapshot: {
                  temperature_C: 24,
                  relativeHumidity_percent: 55,
                  co2_ppm: 800,
                  vpd_kPa: 1.2,
                  ach_measured: 5.1,
                  ach_target: 6,
                  status: 'ok'
                },
                telemetry: [
                  {
                    simTimeHours: 12,
                    temperature_C: 24,
                    relativeHumidity_percent: 55,
                    co2_ppm: 800,
                    vpd_kPa: 1.2,
                    ach: 5.1
                  }
                ]
              },
              deviceCoverage: {
                lightingCoverage01: 0.95,
                hvacCapacity01: 0.9,
                ach: 5.1,
                achTarget: 6,
                warnings: []
              },
              devices: [],
              tasks: [],
              outstandingTaskCount: 0,
              warnings: []
            }
          ],
          outstandingTaskCount: 0,
          warnings: []
        }
      ],
      outstandingTaskCount: 0,
      warnings: []
    }
  ]
};

export function cloneCompanyTreeFixture(): CompanyTreeReadModel {
  return structuredClone(COMPANY_TREE_FIXTURE);
}

