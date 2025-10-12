import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPANY_TREE_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  type CompanyTreeReadModel,
  type WorkforceViewReadModel
} from '../../../src/readModels/api/schemas.ts';
import {
  ReadModelClientError,
  fetchCompanyTree,
  fetchStructureTariffs,
  fetchWorkforceView
} from '../../../src/readModels/client.ts';

const BASE_URL = 'https://facade.example.test';

const COMPANY_ID = '00000000-0000-0000-0000-000000000200';
const STRUCTURE_ID = '00000000-0000-0000-0000-000000000201';
const ROOM_ID = '00000000-0000-0000-0000-000000000202';
const ZONE_ID = '00000000-0000-0000-0000-000000000203';

const COMPANY_TREE_PAYLOAD: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 4,
  companyId: COMPANY_ID,
  name: 'Weed Breed GmbH',
  structures: [
    {
      id: STRUCTURE_ID,
      name: 'HQ Campus',
      rooms: [
        {
          id: ROOM_ID,
          name: 'Flower Room',
          zones: [
            {
              id: ZONE_ID,
              name: 'Zone A',
              area_m2: 24,
              volume_m3: 72
            }
          ]
        }
      ]
    }
  ]
};

const WORKFORCE_VIEW_PAYLOAD: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 4,
  headcount: 5,
  roles: {
    gardener: 2,
    technician: 2,
    janitor: 1
  },
  kpis: {
    utilization: 0.78,
    warnings: []
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchCompanyTree', () => {
  it('returns the parsed payload when the backend responds with valid data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(COMPANY_TREE_PAYLOAD)
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchCompanyTree(`${BASE_URL}/`);

    expect(payload).toEqual(COMPANY_TREE_PAYLOAD);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/companyTree`);
  });

  it('wraps network failures with a ReadModelClientError carrying the network reason', async () => {
    const failure = new TypeError('Network down');
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCompanyTree(BASE_URL)).rejects.toMatchObject({
      name: 'ReadModelClientError',
      reason: 'network'
    });
  });
});

describe('fetchStructureTariffs', () => {
  it('throws a typed error when the backend responds with a non-2xx status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({})
    }));

    await expect(fetchStructureTariffs(BASE_URL)).rejects.toMatchObject({
      name: 'ReadModelClientError',
      reason: 'http',
      status: 503
    });
  });
});

describe('fetchWorkforceView', () => {
  it('surfaces schema validation issues with the typed error helper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ...WORKFORCE_VIEW_PAYLOAD,
          roles: {
            ...WORKFORCE_VIEW_PAYLOAD.roles,
            gardener: -1
          }
        })
    }));

    await expect(fetchWorkforceView(BASE_URL)).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof ReadModelClientError)) {
        return false;
      }
      expect(error.reason).toBe('schema');
      expect(error.issues?.[0]?.path).toEqual(['roles', 'gardener']);
      return true;
    });
  });

  it('returns the validated workforce payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(WORKFORCE_VIEW_PAYLOAD)
    }));

    const payload = await fetchWorkforceView(BASE_URL);

    expect(payload).toEqual(WORKFORCE_VIEW_PAYLOAD);
  });
});
