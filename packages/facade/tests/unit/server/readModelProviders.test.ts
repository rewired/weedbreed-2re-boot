import { describe, expect, it } from 'vitest';

import { initializeFacade } from '../../../src/index.ts';
import { createReadModelProviders } from '../../../src/server/readModelProviders.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import { computeVpd_kPa } from '@/backend/src/physiology/vpd.ts';
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

  it('hydrates room and zone climate snapshots using deterministic world state', async () => {
    const { world, companyWorld } = createDeterministicWorld();
    const { engineConfig } = initializeFacade({
      scenarioId: 'deterministic',
      verbose: false,
      world: companyWorld
    });

    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const snapshot = await providers.readModels();

    const alpha = snapshot.structures.find((structure) => structure.name === 'Small Warehouse Alpha');
    expect(alpha).toBeDefined();
    if (!alpha) {
      throw new Error('Small Warehouse Alpha not found');
    }

    const growRoom = alpha.rooms.find((room) => room.purpose === 'growroom');
    expect(growRoom).toBeDefined();
    if (!growRoom) {
      throw new Error('Growroom snapshot missing');
    }

    const firstZone = growRoom.zones[0];
    expect(firstZone.climateSnapshot.temperature_C).toBeCloseTo(24, 6);
    expect(firstZone.climateSnapshot.relativeHumidity_percent).toBe(58);
    expect(firstZone.climateSnapshot.vpd_kPa).toBeCloseTo(computeVpd_kPa(24, 0.58), 6);

    const expectedAchZoneOne = 350 / (180 * 3);
    expect(firstZone.climateSnapshot.ach_measured).toBeCloseTo(expectedAchZoneOne, 6);
    expect(firstZone.coverageWarnings).not.toHaveLength(0);

    const expectedAchZoneTwo = 170 / (140 * 3);
    const expectedRoomAch = (expectedAchZoneOne + expectedAchZoneTwo) / 2;
    expect(growRoom.climateSnapshot.ach).toBeCloseTo(expectedRoomAch, 6);
    expect(growRoom.coverage.achCurrent).toBeCloseTo(expectedRoomAch, 6);
    expect(growRoom.coverage.climateWarnings).not.toHaveLength(0);
  });

  it('exposes compatibility maps and price book entries for deterministic blueprints', async () => {
    const { world, companyWorld } = createDeterministicWorld();
    const { engineConfig } = initializeFacade({
      scenarioId: 'deterministic',
      verbose: false,
      world: companyWorld
    });

    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const snapshot = await providers.readModels();

    const firstStructure = world.company.structures[0];
    const firstZone = firstStructure.rooms[0]?.zones[0];
    const secondZone = firstStructure.rooms[0]?.zones[1];
    if (!firstZone || !secondZone) {
      throw new Error('Deterministic zones missing');
    }

    const irrigationMap = snapshot.compatibility.cultivationToIrrigation[firstZone.cultivationMethodId];
    expect(irrigationMap).toBeDefined();
    expect(irrigationMap?.[firstZone.irrigationMethodId]).toBe('ok');
    expect(irrigationMap?.[secondZone.irrigationMethodId]).toBe('warn');

    const containerEntry = snapshot.priceBook.containers.find(
      (entry) => entry.containerId === firstZone.containerId
    );
    expect(containerEntry).toBeDefined();
    expect(containerEntry?.pricePerUnit).toBeGreaterThan(0);

    const deviceSlug = firstZone.devices[0]?.slug;
    const deviceEntry = snapshot.priceBook.devices.find((entry) => entry.deviceSlug === deviceSlug);
    expect(deviceEntry).toBeDefined();
    expect(deviceEntry?.capitalExpenditure).toBeGreaterThan(0);
  });

  it('maps workforce zone tasks from the active queue', async () => {
    const { world, companyWorld } = createDeterministicWorld();
    const targetStructure = world.company.structures[0];
    const targetZone = targetStructure.rooms[0]?.zones[0];
    if (!targetZone) {
      throw new Error('Expected deterministic zone');
    }

    const employeeId = world.workforce.employees[0]?.id ?? ('00000000-0000-4000-8000-000000000021' as Uuid);

    world.workforce = {
      ...world.workforce,
      taskQueue: [
        {
          id: '00000000-0000-4000-8000-000000000099' as Uuid,
          taskCode: 'harvest_plants',
          status: 'queued',
          createdAtTick: 12,
          dueTick: 24,
          assignedEmployeeId: employeeId,
          context: { zoneId: targetZone.id }
        }
      ]
    } as typeof world.workforce;

    const { engineConfig } = initializeFacade({
      scenarioId: 'deterministic',
      verbose: false,
      world: companyWorld
    });

    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const snapshot = await providers.readModels();

    const structureSnapshot = snapshot.structures.find((structure) => structure.id === targetStructure.id);
    expect(structureSnapshot).toBeDefined();
    if (!structureSnapshot) {
      throw new Error('Structure snapshot missing');
    }

    const targetGrowRoom = targetStructure.rooms.find((room) => room.purpose === 'growroom');
    expect(targetGrowRoom).toBeDefined();
    if (!targetGrowRoom) {
      throw new Error('Target grow room missing');
    }
    const roomSnapshot = structureSnapshot.rooms.find((room) => room.id === targetGrowRoom.id);
    expect(roomSnapshot).toBeDefined();
    if (!roomSnapshot) {
      throw new Error('Room snapshot missing');
    }

    const zoneSnapshot = roomSnapshot.zones.find((zone) => zone.id === targetZone.id);
    expect(zoneSnapshot).toBeDefined();
    if (!zoneSnapshot) {
      throw new Error('Zone snapshot missing');
    }

    expect(zoneSnapshot.tasks).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000099',
        type: 'harvest',
        status: 'queued',
        assigneeId: employeeId,
        scheduledTick: 24,
        targetZoneId: targetZone.id
      }
    ]);
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
