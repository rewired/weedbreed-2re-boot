import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  uuidSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel,
} from '../../../src/readModels/api/schemas.ts';
import { createReadModelHttpServer } from '../../../src/server/http.ts';

type Providers = Parameters<typeof createReadModelHttpServer>[0]['providers'];

const STUB_COMPANY_TREE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 0,
  companyId: uuidSchema.parse('00000000-0000-0000-0000-000000000000'),
  name: 'Stub Company',
  structures: [
    {
      id: uuidSchema.parse('00000000-0000-0000-0000-000000000001'),
      name: 'Stub Structure',
      rooms: [
        {
          id: uuidSchema.parse('00000000-0000-0000-0000-000000000002'),
          name: 'Stub Room',
          zones: [
            {
              id: uuidSchema.parse('00000000-0000-0000-0000-000000000003'),
              name: 'Stub Zone',
              area_m2: 1,
              volume_m3: 3,
            },
          ],
        },
      ],
    },
  ],
};

const STUB_STRUCTURE_TARIFFS: StructureTariffsReadModel = {
  schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
  simTime: 0,
  electricity_kwh_price: 0.2,
  water_m3_price: 1.1,
  co2_kg_price: 0.5,
  currency: null,
};

const STUB_WORKFORCE_VIEW: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 0,
  headcount: 1,
  roles: {
    gardener: 1,
    technician: 0,
    janitor: 0,
  },
  kpis: {
    utilization: 0.5,
    warnings: [],
  },
};

describe('createReadModelHttpServer', () => {
  let server: FastifyInstance | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('exposes a /healthz endpoint for GET and HEAD requests', async () => {
    const providers: Providers = {
      companyTree: () => STUB_COMPANY_TREE,
      structureTariffs: () => STUB_STRUCTURE_TARIFFS,
      workforceView: () => STUB_WORKFORCE_VIEW,
    };

    server = createReadModelHttpServer({ providers });

    const getResponse = await server.inject({ method: 'GET', url: '/healthz' });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(getResponse.json()).toStrictEqual({ status: 'ok' });

    const headResponse = await server.inject({ method: 'HEAD', url: '/healthz' });
    expect(headResponse.statusCode).toBe(200);
    expect(headResponse.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(headResponse.body).toBe('');
  });
});
