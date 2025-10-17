/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  uuidSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from '../readModels/api/schemas.js';
import {
  composeReadModelSnapshot,
  type CompatibilityMaps,
  type EconomyReadModel,
  type HrReadModel,
  type PriceBookCatalog,
  type ReadModelSnapshot,
  type SimulationReadModel,
  type StructureReadModel,
} from '../readModels/snapshot.js';
import { createReadModelHttpServer } from './http.js';

const DEFAULT_SIM_TIME_HOURS = 0;
const DEMO_ZONE_AREA_M2 = 48;
const DEMO_ZONE_VOLUME_M3 = 144;
const DEMO_ELECTRICITY_PRICE_PER_KWH = 0.35;
const DEMO_WATER_PRICE_PER_M3 = 3.8;
const DEMO_CO2_PRICE_PER_KG = 0.92;
const DEMO_HEADCOUNT = 4;
const DEMO_GARDENER_COUNT = 2;
const DEMO_TECHNICIAN_COUNT = 1;
const DEMO_JANITOR_COUNT = 1;
const DEMO_UTILIZATION = 0.68;
const DEFAULT_HTTP_PORT = 3333;
const DECIMAL_RADIX = 10;
const DEMO_STRUCTURE_ID = uuidSchema.parse('00000000-0000-0000-0000-000000100001');
const DEMO_ROOM_ID = uuidSchema.parse('00000000-0000-0000-0000-000000100002');
const DEMO_ZONE_ID = uuidSchema.parse('00000000-0000-0000-0000-000000100003');

const SAMPLE_COMPANY_TREE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: DEFAULT_SIM_TIME_HOURS,
  companyId: uuidSchema.parse('00000000-0000-0000-0000-000000100000'),
  name: 'Weed Breed Demo GmbH',
  structures: [
    {
      id: DEMO_STRUCTURE_ID,
      name: 'Demo Campus',
      rooms: [
        {
          id: DEMO_ROOM_ID,
          name: 'Propagation Room',
          zones: [
            {
              id: DEMO_ZONE_ID,
              name: 'Zone Alpha',
              area_m2: DEMO_ZONE_AREA_M2,
              volume_m3: DEMO_ZONE_VOLUME_M3
            }
          ]
        }
      ]
    }
  ]
};

const SAMPLE_STRUCTURE_TARIFFS: StructureTariffsReadModel = {
  schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
  simTime: DEFAULT_SIM_TIME_HOURS,
  electricity_kwh_price: DEMO_ELECTRICITY_PRICE_PER_KWH,
  water_m3_price: DEMO_WATER_PRICE_PER_M3,
  co2_kg_price: DEMO_CO2_PRICE_PER_KG,
  currency: null
};

const SAMPLE_WORKFORCE_VIEW: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: DEFAULT_SIM_TIME_HOURS,
  headcount: DEMO_HEADCOUNT,
  roles: {
    gardener: DEMO_GARDENER_COUNT,
    technician: DEMO_TECHNICIAN_COUNT,
    janitor: DEMO_JANITOR_COUNT
  },
  kpis: {
    utilization: DEMO_UTILIZATION,
    warnings: []
  }
};

const SAMPLE_SIMULATION_SNAPSHOT: SimulationReadModel = {
  simTimeHours: DEFAULT_SIM_TIME_HOURS,
  day: 0,
  hour: 0,
  tick: 0,
  speedMultiplier: 1,
  pendingIncidents: [
    {
      id: '00000000-0000-0000-0000-000000200000',
      code: 'irrigation.checkup',
      message: 'Verify dripper flow after maintenance.',
      severity: 'info',
      raisedAtTick: 0
    }
  ]
};

const SAMPLE_ECONOMY_SNAPSHOT: EconomyReadModel = {
  balance: 125_000,
  deltaPerHour: 420,
  operatingCostPerHour: 260,
  labourCostPerHour: 110,
  utilitiesCostPerHour: 50
};

const SAMPLE_STRUCTURE_SNAPSHOT: StructureReadModel = {
  id: DEMO_STRUCTURE_ID,
  name: 'Demo Campus',
  location: 'Berlin, Germany',
  area_m2: 120,
  volume_m3: 360,
  capacity: {
    areaUsed_m2: 72,
    areaFree_m2: 48,
    volumeUsed_m3: 216,
    volumeFree_m3: 144
  },
  coverage: {
    lightingCoverage01: 0.82,
    hvacCapacity01: 0.76,
    airflowAch: 12,
    warnings: []
  },
  kpis: {
    energyKwhPerDay: 285,
    waterM3PerDay: 3.2,
    labourHoursPerDay: 16,
    maintenanceCostPerHour: 4.1
  },
  devices: [],
  rooms: [
    {
      id: DEMO_ROOM_ID,
      structureId: DEMO_STRUCTURE_ID,
      name: 'Propagation Room',
      purpose: 'growroom',
      area_m2: 96,
      volume_m3: 288,
      capacity: {
        areaUsed_m2: 60,
        areaFree_m2: 36,
        volumeUsed_m3: 180,
        volumeFree_m3: 108
      },
      coverage: {
        achCurrent: 11,
        achTarget: 12,
        climateWarnings: []
      },
      climateSnapshot: {
        temperature_C: 24.3,
        relativeHumidity_percent: 58,
        co2_ppm: 820,
        ach: 11,
        notes: 'Holding steady'
      },
      devices: [],
      zones: [
        {
          id: DEMO_ZONE_ID,
          name: 'Zone Alpha',
          area_m2: DEMO_ZONE_AREA_M2,
          volume_m3: DEMO_ZONE_VOLUME_M3,
          cultivationMethodId: 'sea-of-green',
          irrigationMethodId: 'drip',
          strainId: 'strain-demo-001',
          maxPlants: 320,
          currentPlantCount: 288,
          kpis: {
            healthPercent: 92,
            qualityPercent: 88,
            stressPercent: 14,
            biomass_kg: 52,
            growthRatePercent: 18
          },
          pestStatus: {
            activeIssues: 0,
            dueInspections: 1,
            upcomingTreatments: 0,
            nextInspectionTick: 24,
            lastInspectionTick: 0
          },
          devices: [],
          coverageWarnings: [],
          climateSnapshot: {
            temperature_C: 24.5,
            relativeHumidity_percent: 57,
            co2_ppm: 830,
            vpd_kPa: 1.1,
            ach_measured: 11.2,
            ach_target: 12,
            status: 'ok'
          },
          timeline: [],
          tasks: []
        }
      ],
      timeline: []
    }
  ],
  workforce: {
    activeAssignments: [],
    openTasks: 0,
    notes: 'All shifts covered'
  },
  timeline: []
};

const SAMPLE_HR_SNAPSHOT: HrReadModel = {
  directory: [
    {
      id: '00000000-0000-0000-0000-000000300000',
      name: 'Alex Demo',
      role: 'Gardener',
      hourlyCost: 22,
      moralePercent: 92,
      fatiguePercent: 18,
      skills: ['canopy-training', 'sanitation'],
      assignment: {
        employeeId: '00000000-0000-0000-0000-000000300000',
        employeeName: 'Alex Demo',
        role: 'gardener',
        assignedScope: 'zone',
        targetId: DEMO_ZONE_ID
      },
      overtimeMinutes: 0
    }
  ],
  activityTimeline: [
    {
      id: '00000000-0000-0000-0000-000000310000',
      timestamp: 0,
      title: 'Shift briefing',
      scope: 'structure',
      description: 'Reviewed propagation tasks.',
      assigneeId: '00000000-0000-0000-0000-000000300000'
    }
  ],
  taskQueues: [
    {
      id: '00000000-0000-0000-0000-000000320000',
      title: 'Propagation Tasks',
      entries: [
        {
          id: '00000000-0000-0000-0000-000000320001',
          type: 'inspection',
          targetId: DEMO_ZONE_ID,
          targetScope: 'zone',
          dueTick: 12,
          status: 'queued',
          assigneeId: null
        }
      ]
    }
  ],
  capacitySnapshot: [
    {
      role: 'gardener',
      headcount: 2,
      queuedTasks: 1,
      coverageStatus: 'ok'
    }
  ]
};

const SAMPLE_PRICE_BOOK: PriceBookCatalog = {
  seedlings: [
    {
      id: 'seedling-demo-001',
      strainId: 'strain-demo-001',
      pricePerUnit: 4.5
    }
  ],
  containers: [
    {
      id: 'container-demo-001',
      containerId: 'pot-10l',
      capacityLiters: 10,
      pricePerUnit: 2.5,
      serviceLifeCycles: 8
    }
  ],
  substrates: [
    {
      id: 'substrate-demo-001',
      substrateId: 'coco-basic',
      unitPrice_per_L: 0.18,
      densityFactor_L_per_kg: 0.7,
      reuseCycles: 1
    }
  ],
  irrigationLines: [
    {
      id: 'irrigation-demo-001',
      irrigationMethodId: 'drip',
      pricePerSquareMeter: 6.5
    }
  ],
  devices: [
    {
      id: 'device-demo-001',
      deviceSlug: 'hvac-basic',
      coverageArea_m2: 60,
      throughput_m3_per_hour: 120,
      capitalExpenditure: 1800
    }
  ]
};

const SAMPLE_COMPATIBILITY_MAPS: CompatibilityMaps = {
  cultivationToIrrigation: {
    'sea-of-green': {
      drip: 'ok',
      ebbflow: 'warn'
    }
  },
  strainToCultivation: {
    'strain-demo-001': {
      cultivation: {
        'sea-of-green': 'ok'
      },
      irrigation: {
        drip: 'ok'
      }
    }
  }
};

const SAMPLE_READ_MODEL_SNAPSHOT: ReadModelSnapshot = composeReadModelSnapshot({
  simulation: SAMPLE_SIMULATION_SNAPSHOT,
  economy: SAMPLE_ECONOMY_SNAPSHOT,
  structures: [SAMPLE_STRUCTURE_SNAPSHOT],
  hr: SAMPLE_HR_SNAPSHOT,
  priceBook: SAMPLE_PRICE_BOOK,
  compatibility: SAMPLE_COMPATIBILITY_MAPS
});

const port = Number.parseInt(
  process.env.FACADE_HTTP_PORT ?? DEFAULT_HTTP_PORT.toString(),
  DECIMAL_RADIX
);

const server = createReadModelHttpServer({
  providers: {
    companyTree: () => SAMPLE_COMPANY_TREE,
    structureTariffs: () => SAMPLE_STRUCTURE_TARIFFS,
    workforceView: () => SAMPLE_WORKFORCE_VIEW,
    readModels: () => SAMPLE_READ_MODEL_SNAPSHOT
  }
});

await server
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`Read-model HTTP server listening on http://localhost:${String(port)}`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to start read-model HTTP server', message);
    process.exitCode = 1;
  });
