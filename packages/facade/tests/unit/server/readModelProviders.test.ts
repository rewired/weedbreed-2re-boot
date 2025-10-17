import { describe, expect, it } from 'vitest';

import { initializeFacade } from '../../../src/index.ts';
import { createReadModelProviders } from '../../../src/server/readModelProviders.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import { createDeterministicWorld } from '@wb/facade/backend/deterministicWorldLoader';
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

  it('computes deterministic structure KPI metrics', async () => {
    const { world, companyWorld } = createDeterministicWorld();
    const { engineConfig } = initializeFacade({
      scenarioId: 'deterministic',
      verbose: false,
      world: companyWorld
    });

    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const snapshot = await providers.readModels();

    expect(snapshot.structures).toHaveLength(2);
    const structuresByName = Object.fromEntries(
      snapshot.structures.map((structure) => [structure.name, structure])
    );
    const alpha = structuresByName['Small Warehouse Alpha'];
    const beta = structuresByName['Medium Warehouse Beta'];

    expect(alpha).toBeDefined();
    expect(beta).toBeDefined();

    if (!alpha || !beta) {
      throw new Error('Deterministic structures not found in snapshot');
    }

    expect(alpha.coverage.lightingCoverage01).toBeCloseTo(0.0075, 6);
    expect(alpha.coverage.hvacCapacity01).toBeCloseTo(0.09375, 6);
    expect(alpha.coverage.airflowAch).toBeCloseTo(0.541667, 6);
    expect(alpha.kpis.energyKwhPerDay).toBeCloseTo(48, 6);
    expect(alpha.kpis.waterM3PerDay).toBeCloseTo(2.164706, 6);
    expect(alpha.kpis.labourHoursPerDay).toBeCloseTo(93.27381, 6);
    expect(alpha.kpis.maintenanceCostPerHour).toBeCloseTo(0.0085, 6);
    expect(alpha.coverage.warnings).toHaveLength(3);

    expect(beta.coverage.lightingCoverage01).toBeCloseTo(0.005, 6);
    expect(beta.coverage.hvacCapacity01).toBeCloseTo(0.034708, 6);
    expect(beta.coverage.airflowAch).toBeCloseTo(0, 6);
    expect(beta.kpis.energyKwhPerDay).toBeCloseTo(15.6, 6);
    expect(beta.kpis.waterM3PerDay).toBeCloseTo(0.172549, 6);
    expect(beta.kpis.labourHoursPerDay).toBeCloseTo(41.22619, 6);
    expect(beta.kpis.maintenanceCostPerHour).toBeCloseTo(0.004, 6);
    expect(beta.coverage.warnings).toHaveLength(3);
  });

  it('freezes read-model snapshots and aggregates economy costs', async () => {
    const { world, companyWorld } = createDeterministicWorld();
    const { engineConfig } = initializeFacade({
      scenarioId: 'deterministic',
      verbose: false,
      world: companyWorld
    });

    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const snapshot = await providers.readModels();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.structures)).toBe(true);

    expect(snapshot.economy.labourCostPerHour).toBeCloseTo(64.6, 6);
    expect(snapshot.economy.utilitiesCostPerHour).toBeCloseTo(1.122271, 6);
    expect(snapshot.economy.operatingCostPerHour).toBeCloseTo(65.734771, 6);
    expect(snapshot.economy.deltaPerHour).toBeCloseTo(-65.734771, 6);

    expect(() => {
      const first = snapshot.structures[0] as unknown as { coverage: { lightingCoverage01: number } };
      first.coverage.lightingCoverage01 = 1;
    }).toThrow(TypeError);
  });
});
