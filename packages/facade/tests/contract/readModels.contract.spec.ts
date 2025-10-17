import { describe, expect, it } from 'vitest';

import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  companyTreeSchema,
  structureTariffsSchema,
  workforceViewSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel,
} from '../../src/readModels/api/schemas.ts';
import { validateReadModelSnapshot } from '../../src/readModels/snapshot.ts';
import { createContractServerHarness } from './utils/server.ts';
import { TEST_READ_MODEL_SNAPSHOT } from '../fixtures/readModelSnapshot.ts';

const COMPANY_TREE_FIXTURE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 8,
  companyId: '00000000-0000-0000-0000-000000000310',
  name: 'Contract Harness Company',
  structures: [
    {
      id: '00000000-0000-0000-0000-000000000311',
      name: 'Primary Campus',
      rooms: [
        {
          id: '00000000-0000-0000-0000-000000000312',
          name: 'Propagation Room',
          zones: [
            {
              id: '00000000-0000-0000-0000-000000000313',
              name: 'Zone Alpha',
              area_m2: 42,
              volume_m3: 126,
            },
          ],
        },
      ],
    },
  ],
};

const STRUCTURE_TARIFFS_FIXTURE: StructureTariffsReadModel = {
  schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
  simTime: 8,
  electricity_kwh_price: 0.38,
  water_m3_price: 3.65,
  co2_kg_price: 1.1,
  currency: null,
};

const WORKFORCE_VIEW_FIXTURE: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 8,
  headcount: 5,
  roles: {
    gardener: 3,
    technician: 1,
    janitor: 1,
  },
  kpis: {
    utilization: 0.72,
    warnings: [],
  },
};

describe('contract — read-model HTTP endpoints', () => {
  it('serve schema-compliant payloads for all endpoints', async () => {
    const harness = await createContractServerHarness({
      providers: {
        companyTree: () => COMPANY_TREE_FIXTURE,
        structureTariffs: () => STRUCTURE_TARIFFS_FIXTURE,
        workforceView: () => WORKFORCE_VIEW_FIXTURE,
        readModels: () => TEST_READ_MODEL_SNAPSHOT,
      },
    });

    try {
      const companyTreeResponse = await fetch(`${harness.http.url}/api/companyTree`);
      expect(companyTreeResponse.status).toBe(200);
      const companyTreeBody = companyTreeSchema.parse(await companyTreeResponse.json());
      expect(companyTreeBody).toEqual(COMPANY_TREE_FIXTURE);

      const structureTariffsResponse = await fetch(`${harness.http.url}/api/structureTariffs`);
      expect(structureTariffsResponse.status).toBe(200);
      const structureTariffsBody = structureTariffsSchema.parse(
        await structureTariffsResponse.json(),
      );
      expect(structureTariffsBody).toEqual(STRUCTURE_TARIFFS_FIXTURE);

      const workforceViewResponse = await fetch(`${harness.http.url}/api/workforceView`);
      expect(workforceViewResponse.status).toBe(200);
      const workforceViewBody = workforceViewSchema.parse(await workforceViewResponse.json());
      expect(workforceViewBody).toEqual(WORKFORCE_VIEW_FIXTURE);

      const snapshotResponse = await fetch(`${harness.http.url}/api/read-models`);
      expect(snapshotResponse.status).toBe(200);
      const snapshotBody = validateReadModelSnapshot(await snapshotResponse.json());
      expect(snapshotBody).toEqual(TEST_READ_MODEL_SNAPSHOT);
    } finally {
      await harness.close();
    }
  });
});
