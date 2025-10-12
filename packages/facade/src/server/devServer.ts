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

const SAMPLE_COMPANY_TREE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: DEFAULT_SIM_TIME_HOURS,
  companyId: uuidSchema.parse('00000000-0000-0000-0000-000000100000'),
  name: 'Weed Breed Demo GmbH',
  structures: [
    {
      id: uuidSchema.parse('00000000-0000-0000-0000-000000100001'),
      name: 'Demo Campus',
      rooms: [
        {
          id: uuidSchema.parse('00000000-0000-0000-0000-000000100002'),
          name: 'Propagation Room',
          zones: [
            {
              id: uuidSchema.parse('00000000-0000-0000-0000-000000100003'),
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

const port = Number.parseInt(
  process.env.FACADE_HTTP_PORT ?? DEFAULT_HTTP_PORT.toString(),
  DECIMAL_RADIX
);

const server = createReadModelHttpServer({
  providers: {
    companyTree: () => SAMPLE_COMPANY_TREE,
    structureTariffs: () => SAMPLE_STRUCTURE_TARIFFS,
    workforceView: () => SAMPLE_WORKFORCE_VIEW
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
