import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  companyTreeSchema,
  structureTariffsSchema,
  workforceViewSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from '../../../src/readModels/api/schemas.ts';
import { validateReadModelSnapshot } from '../../../src/readModels/snapshot.ts';
import { createReadModelHttpServer, type ReadModelHttpServer } from '../../../src/server/http.ts';
import { TEST_READ_MODEL_SNAPSHOT } from '../../fixtures/readModelSnapshot.ts';

const COMPANY_TREE_PAYLOAD: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 12,
  companyId: '00000000-0000-0000-0000-000000000200',
  name: 'Integration Company',
  structures: [
    {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'HQ Facility',
      rooms: [
        {
          id: '00000000-0000-0000-0000-000000000202',
          name: 'Flower Room',
          zones: [
            {
              id: '00000000-0000-0000-0000-000000000203',
              name: 'Zone One',
              area_m2: 36,
              volume_m3: 108
            }
          ]
        }
      ]
    }
  ]
};

const STRUCTURE_TARIFFS_PAYLOAD: StructureTariffsReadModel = {
  schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
  simTime: 12,
  electricity_kwh_price: 0.42,
  water_m3_price: 3.4,
  co2_kg_price: 1.05,
  currency: null
};

const WORKFORCE_VIEW_PAYLOAD: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 12,
  headcount: 7,
  roles: {
    gardener: 4,
    technician: 2,
    janitor: 1
  },
  roster: [
    {
      employeeId: '00000000-0000-0000-0000-000000000501',
      displayName: 'Taylor Morgan',
      structureId: COMPANY_TREE_PAYLOAD.structures[0]!.id,
      roleSlug: 'gardener',
      morale01: 0.7,
      fatigue01: 0.3,
      currentTaskId: null,
      nextShiftStartTick: 24,
      baseHoursPerDay: 8,
      overtimeHoursPerDay: 1,
      daysPerWeek: 5,
      shiftStartHour: 7,
      assignment: {
        scope: 'structure',
        targetId: COMPANY_TREE_PAYLOAD.structures[0]!.id
      }
    }
  ],
  kpis: {
    utilizationPercent: 71,
    overtimeMinutes: 45,
    warnings: []
  }
};

const activeServers: ReadModelHttpServer[] = [];

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    if (!server) {
      break;
    }

    await server.close();
  }
});

describe('read-model HTTP endpoints', () => {
  it('responds with 200 and validated payloads for each endpoint', async () => {
    const server = createReadModelHttpServer({
      providers: {
        companyTree: () => COMPANY_TREE_PAYLOAD,
        structureTariffs: () => STRUCTURE_TARIFFS_PAYLOAD,
        workforceView: () => WORKFORCE_VIEW_PAYLOAD,
        readModels: () => TEST_READ_MODEL_SNAPSHOT
      }
    });
    activeServers.push(server);

    const companyTreeResponse = await server.inject({ method: 'GET', url: '/api/companyTree' });
    expect(companyTreeResponse.statusCode).toBe(200);
    const companyTreeBody = companyTreeSchema.parse(companyTreeResponse.json());
    expect(companyTreeBody).toEqual(COMPANY_TREE_PAYLOAD);

    const structureTariffsResponse = await server.inject({ method: 'GET', url: '/api/structureTariffs' });
    expect(structureTariffsResponse.statusCode).toBe(200);
    const structureTariffsBody = structureTariffsSchema.parse(structureTariffsResponse.json());
    expect(structureTariffsBody).toEqual(STRUCTURE_TARIFFS_PAYLOAD);

    const workforceViewResponse = await server.inject({ method: 'GET', url: '/api/workforceView' });
    expect(workforceViewResponse.statusCode).toBe(200);
    const workforceViewBody = workforceViewSchema.parse(workforceViewResponse.json());
    expect(workforceViewBody).toEqual(WORKFORCE_VIEW_PAYLOAD);

    const snapshotResponse = await server.inject({ method: 'GET', url: '/api/read-models' });
    expect(snapshotResponse.statusCode).toBe(200);
    const snapshotBody = validateReadModelSnapshot(snapshotResponse.json());
    expect(snapshotBody).toEqual(TEST_READ_MODEL_SNAPSHOT);
  });

  it('returns 500 and logs an error when a payload fails validation', async () => {
    const logger = {
      error: vi.fn<[string, Record<string, unknown>?], undefined>()
    };
    const invalidPayload = {
      ...COMPANY_TREE_PAYLOAD,
      simTime: -1
    } as unknown as CompanyTreeReadModel;

    const server = createReadModelHttpServer({
      logger,
      providers: {
        companyTree: () => invalidPayload,
        structureTariffs: () => STRUCTURE_TARIFFS_PAYLOAD,
        workforceView: () => WORKFORCE_VIEW_PAYLOAD,
        readModels: () => TEST_READ_MODEL_SNAPSHOT
      }
    });
    activeServers.push(server);

    const response = await server.inject({ method: 'GET', url: '/api/companyTree' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Failed to compose read-model.' });
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [[message, details]] = logger.error.mock.calls as [
      [string, Record<string, unknown>]
    ];
    expect(message).toBe('Failed to compose companyTree read-model');
    const errorDetail = details.error;
    expect(typeof errorDetail).toBe('string');
  });

  it('logs and responds with 500 when the read-model snapshot provider throws', async () => {
    const logger = {
      error: vi.fn<[string, Record<string, unknown>?], undefined>()
    };

    const error = new Error('snapshot unavailable');
    const server = createReadModelHttpServer({
      logger,
      providers: {
        companyTree: () => COMPANY_TREE_PAYLOAD,
        structureTariffs: () => STRUCTURE_TARIFFS_PAYLOAD,
        workforceView: () => WORKFORCE_VIEW_PAYLOAD,
        readModels: () => {
          throw error;
        }
      }
    });
    activeServers.push(server);

    const response = await server.inject({ method: 'GET', url: '/api/read-models' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Failed to compose read-model.' });
    expect(logger.error).toHaveBeenCalledWith('Failed to compose readModels read-model', {
      error: error.message
    });
  });
});
