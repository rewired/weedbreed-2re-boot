import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
import { cloneCompanyTreeFixture } from '../../fixtures/companyTree.ts';

const BASE_URL = 'https://facade.example.test';

const COMPANY_TREE_PAYLOAD: CompanyTreeReadModel = cloneCompanyTreeFixture();

const WORKFORCE_VIEW_PAYLOAD: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 4,
  headcount: 5,
  roles: {
    gardener: 2,
    technician: 2,
    janitor: 1
  },
  assignments: [
    {
      structureId: COMPANY_TREE_PAYLOAD.structures[0]!.id,
      structureName: COMPANY_TREE_PAYLOAD.structures[0]!.name,
      headcount: 3,
      employeeIds: [
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000603'
      ]
    }
  ],
  roster: [
    {
      employeeId: '00000000-0000-0000-0000-000000000601',
      displayName: 'Morgan Lee',
      structureId: COMPANY_TREE_PAYLOAD.structures[0]!.id,
      roleSlug: 'gardener',
      morale01: 0.75,
      fatigue01: 0.25,
      currentTaskId: null,
      nextShiftStartTick: 12,
      baseHoursPerDay: 8,
      overtimeHoursPerDay: 1,
      daysPerWeek: 5,
      shiftStartHour: 6,
      assignment: {
        scope: 'structure',
        targetId: COMPANY_TREE_PAYLOAD.structures[0]!.id
      }
    }
  ],
  kpis: {
    utilizationPercent: 78,
    overtimeMinutes: 60,
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
