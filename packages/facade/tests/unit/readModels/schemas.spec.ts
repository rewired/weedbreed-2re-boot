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
  type WorkforceViewReadModel
} from '../../../src/readModels/api/schemas.ts';

const COMPANY_ID = '00000000-0000-0000-0000-000000000100';
const STRUCTURE_ID = '00000000-0000-0000-0000-000000000101';
const ROOM_ID = '00000000-0000-0000-0000-000000000102';
const ZONE_ID = '00000000-0000-0000-0000-000000000103';

const BASE_COMPANY_TREE: CompanyTreeReadModel = {
  schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
  simTime: 12,
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
              area_m2: 42,
              volume_m3: 126
            }
          ]
        }
      ]
    }
  ]
};

const BASE_STRUCTURE_TARIFFS: StructureTariffsReadModel = {
  schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
  simTime: 12,
  electricity_kwh_price: 0.38,
  water_m3_price: 4.2,
  co2_kg_price: 0.8,
  currency: null
};

const BASE_WORKFORCE_VIEW: WorkforceViewReadModel = {
  schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
  simTime: 12,
  headcount: 6,
  roles: {
    gardener: 3,
    technician: 2,
    janitor: 1
  },
  roster: [
    {
      employeeId: '00000000-0000-0000-0000-000000000401',
      displayName: 'Jamie Rivera',
      structureId: STRUCTURE_ID,
      roleSlug: 'gardener',
      morale01: 0.8,
      fatigue01: 0.2,
      currentTaskId: null,
      nextShiftStartTick: 24,
      baseHoursPerDay: 8,
      overtimeHoursPerDay: 2,
      daysPerWeek: 5,
      shiftStartHour: 6,
      assignment: {
        scope: 'structure',
        targetId: STRUCTURE_ID
      }
    }
  ],
  kpis: {
    utilizationPercent: 72,
    overtimeMinutes: 30,
    warnings: [
      {
        code: 'WB_WORKFORCE_OVERTIME',
        message: 'Overtime exceeds threshold.',
        severity: 'warning'
      }
    ]
  }
};

describe('companyTreeSchema', () => {
  it('accepts a valid company tree payload', () => {
    const parsed = companyTreeSchema.parse(BASE_COMPANY_TREE);

    expect(parsed.schemaVersion).toBe(COMPANY_TREE_SCHEMA_VERSION);
    expect(parsed.structures[0].rooms[0].zones[0].area_m2).toBe(42);
  });

  it('rejects non-UUID zone identifiers with a descriptive error', () => {
    const result = companyTreeSchema.safeParse({
      ...BASE_COMPANY_TREE,
      structures: [
        {
          ...BASE_COMPANY_TREE.structures[0],
          rooms: [
            {
              ...BASE_COMPANY_TREE.structures[0].rooms[0],
              zones: [
                {
                  ...BASE_COMPANY_TREE.structures[0].rooms[0].zones[0],
                  id: 'not-a-uuid'
                }
              ]
            }
          ]
        }
      ]
    } as unknown);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.message).toBe('Expected a UUID v4 identifier.');
      expect(issue.path).toEqual(['structures', 0, 'rooms', 0, 'zones', 0, 'id']);
    }
  });
});

describe('structureTariffsSchema', () => {
  it('parses the minimal tariffs payload', () => {
    const parsed = structureTariffsSchema.parse(BASE_STRUCTURE_TARIFFS);

    expect(parsed.schemaVersion).toBe(STRUCTURE_TARIFFS_SCHEMA_VERSION);
    expect(parsed.electricity_kwh_price).toBeCloseTo(0.38);
  });

  it('rejects negative electricity prices with a clear message', () => {
    const result = structureTariffsSchema.safeParse({
      ...BASE_STRUCTURE_TARIFFS,
      electricity_kwh_price: -0.01
    } as unknown);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.message).toBe('electricity_kwh_price must be greater than or equal to zero.');
      expect(issue.path).toEqual(['electricity_kwh_price']);
    }
  });
});

describe('workforceViewSchema', () => {
  it('validates the workforce summary payload', () => {
    const parsed = workforceViewSchema.parse(BASE_WORKFORCE_VIEW);

    expect(parsed.schemaVersion).toBe(WORKFORCE_VIEW_SCHEMA_VERSION);
    expect(parsed.kpis.warnings).toHaveLength(1);
  });

  it('rejects unknown warning severities with an informative message', () => {
    const result = workforceViewSchema.safeParse({
      ...BASE_WORKFORCE_VIEW,
      kpis: {
        ...BASE_WORKFORCE_VIEW.kpis,
        warnings: [
          {
            ...BASE_WORKFORCE_VIEW.kpis.warnings[0],
            severity: 'urgent'
          }
        ]
      }
    } as unknown);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.message).toBe("Invalid enum value. Expected 'info' | 'warning' | 'critical', received 'urgent'");
      expect(issue.path).toEqual(['kpis', 'warnings', 0, 'severity']);
    }
  });
});
