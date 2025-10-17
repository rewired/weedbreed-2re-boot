import { describe, expect, it } from 'vitest';

import { initializeFacade } from '../../../src/index.ts';
import { createReadModelProviders } from '../../../src/server/readModelProviders.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import type {
  Employee,
  EmployeeRole,
  EmployeeRngSeedUuid,
  WorkforceKpiSnapshot,
  WorkforceWarning,
  Uuid
} from '@wb/engine';

function createRole(id: Uuid, slug: string, name: string): EmployeeRole {
  return {
    id,
    slug,
    name,
    coreSkills: []
  } satisfies EmployeeRole;
}

function createEmployee(id: Uuid, roleId: Uuid, structureId: Uuid): Employee {
  return {
    id,
    slug: 'demo-employee',
    name: 'Demo Employee',
    roleId,
    rngSeedUuid: '00000000-0000-4000-8000-000000000031' as EmployeeRngSeedUuid,
    assignedStructureId: structureId,
    morale01: 0.8,
    fatigue01: 0.2,
    skills: [],
    traits: [],
    schedule: {
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
      daysPerWeek: 5
    },
    baseRateMultiplier: 1,
    experience: {
      hoursAccrued: 0,
      level01: 0
    },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 25,
    raise: {
      cadenceSequence: 0
    }
  } satisfies Employee;
}

const SAMPLE_WARNING: WorkforceWarning = {
  simTimeHours: 0,
  code: 'workforce.demo.warning',
  message: 'Demo workforce warning.',
  severity: 'info'
};

const SAMPLE_KPI: WorkforceKpiSnapshot = {
  simTimeHours: 0,
  tasksCompleted: 0,
  queueDepth: 0,
  laborHoursCommitted: 0,
  overtimeHoursCommitted: 0,
  overtimeMinutes: 0,
  utilization01: 0.5,
  p95WaitTimeHours: 0,
  maintenanceBacklog: 0,
  averageMorale01: 0.5,
  averageFatigue01: 0.5
};

describe('createReadModelProviders', () => {
  it('maps simulation state into façade read-model payloads', async () => {
    const world = createDemoWorld();
    const [structure] = world.company.structures;

    const roleId = '00000000-0000-4000-8000-000000000010' as Uuid;
    const employeeId = '00000000-0000-4000-8000-000000000011' as Uuid;

    world.workforce = {
      ...world.workforce,
      roles: [createRole(roleId, 'gardener', 'Gardener')],
      employees: [createEmployee(employeeId, roleId, structure.id)],
      warnings: [SAMPLE_WARNING],
      kpis: [SAMPLE_KPI]
    };

    const { engineConfig, companyWorld } = initializeFacade({
      scenarioId: 'demo',
      verbose: false,
      world: world.company
    });

    const providers = createReadModelProviders({
      world,
      companyWorld,
      config: engineConfig
    });

    const companyTree = await providers.companyTree();
    expect(companyTree.structures).toHaveLength(world.company.structures.length);
    const zone = companyTree.structures[0]?.rooms[0]?.zones[0];
    const sourceZone = world.company.structures[0]?.rooms[0]?.zones[0];
    expect(zone?.area_m2).toBe(sourceZone?.floorArea_m2);

    const tariffs = await providers.structureTariffs();
    expect(tariffs.electricity_kwh_price).toBe(engineConfig.tariffs.price_electricity);
    expect(tariffs.water_m3_price).toBe(engineConfig.tariffs.price_water);

    const workforceView = await providers.workforceView();
    expect(workforceView.headcount).toBe(1);
    expect(workforceView.roles.gardener).toBe(1);
    expect(workforceView.kpis.utilization).toBe(0.5);

    const snapshot = await providers.readModels();
    expect(snapshot.structures).toHaveLength(world.company.structures.length);
    expect(snapshot.simulation.simTimeHours).toBe(world.simTimeHours);
  });
});
