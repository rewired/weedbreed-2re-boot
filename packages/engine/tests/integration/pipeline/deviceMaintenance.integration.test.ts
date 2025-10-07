import { describe, expect, it } from 'vitest';

import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants.js';
import { runTick } from '@/backend/src/engine/Engine.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import {
  mMaintenance,
} from '@/backend/src/device/degradation.js';
import type {
  DeviceMaintenancePolicy,
  DeviceMaintenanceState,
  Room,
  Structure,
  WorkforceTaskDefinition,
  Zone,
  ZoneDeviceInstance,
  Uuid,
} from '@/backend/src/domain/world.js';

const MAINTAIN_TASK_DEFINITION: WorkforceTaskDefinition = {
  taskCode: 'maintain_device',
  description: 'Maintain device',
  requiredRoleSlug: 'technician',
  requiredSkills: [{ skillKey: 'maintenance', minSkill01: 0.8 }],
  priority: 30,
  costModel: { basis: 'perAction', laborMinutes: 30 },
} satisfies WorkforceTaskDefinition;

const WORKSHOP_ROOM_ID = '00000000-0000-4000-8000-000000000201' as Uuid;
const MAINTENANCE_DEVICE_ID = '00000000-0000-4000-8000-000000000202' as Uuid;
const MAINTENANCE_BLUEPRINT_ID = '00000000-0000-4000-8000-000000000203' as Uuid;

const MAINTENANCE_POLICY: DeviceMaintenancePolicy = {
  lifetimeHours: 8_000,
  maintenanceIntervalHours: 720,
  serviceHours: 4,
  restoreAmount01: 0.15,
  baseCostPerHourCc: 0.02,
  costIncreasePer1000HoursCc: 0.001,
  serviceVisitCostCc: 45,
  replacementCostCc: 600,
  maintenanceConditionThreshold01: 0.3,
};

function createWorkshopRoom(): Room {
  return {
    id: WORKSHOP_ROOM_ID,
    slug: 'maintenance-workshop',
    name: 'Maintenance Workshop',
    purpose: 'workshop',
    floorArea_m2: 25,
    height_m: 3,
    devices: [],
    zones: [],
  } satisfies Room;
}

function createMaintenanceDevice(maintenance: DeviceMaintenanceState): ZoneDeviceInstance {
  return {
    id: MAINTENANCE_DEVICE_ID,
    slug: 'maintenance-device',
    name: 'Maintenance Device',
    blueprintId: MAINTENANCE_BLUEPRINT_ID,
    placementScope: 'zone',
    quality01: 0.75,
    condition01: 0.95,
    powerDraw_W: 400,
    dutyCycle01: 1,
    efficiency01: 0.8,
    coverage_m2: 20,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0,
    maintenance,
  } satisfies ZoneDeviceInstance;
}

function computeExpectedMaintenanceCost(
  hours: number,
  policy: DeviceMaintenancePolicy,
  quality01: number,
): number {
  const effectiveInterval = policy.maintenanceIntervalHours / mMaintenance(quality01);
  let runtimeHours = 0;
  let hoursSinceService = 0;
  let totalCost = 0;

  for (let hour = 0; hour < hours; hour += 1) {
    runtimeHours += 1;
    hoursSinceService += 1;
    const hourlyCost =
      policy.baseCostPerHourCc + policy.costIncreasePer1000HoursCc * (runtimeHours / 1_000);
    totalCost += hourlyCost;

    if (hoursSinceService >= effectiveInterval) {
      totalCost += policy.serviceVisitCostCc;
      hoursSinceService = 0;
    }
  }

  return totalCost;
}

describe('Tick pipeline — device maintenance lifecycle', () => {
  it('degrades condition, schedules maintenance, and accrues expected costs over 120 days', () => {
    let world = createDemoWorld();
    const structure = world.company.structures[0] as Structure;
    const growRoom = structure.rooms[0] as Room;
    const zone = growRoom.zones[0] as Zone;

    const maintenanceState: DeviceMaintenanceState = {
      runtimeHours: 0,
      hoursSinceService: 0,
      totalMaintenanceCostCc: 0,
      completedServiceCount: 0,
      recommendedReplacement: false,
      policy: MAINTENANCE_POLICY,
    } satisfies DeviceMaintenanceState;

    const maintenanceDevice = createMaintenanceDevice(maintenanceState);

    zone.devices = [maintenanceDevice];
    structure.rooms = [growRoom, createWorkshopRoom()];

    world.workforce = {
      ...world.workforce,
      taskDefinitions: [MAINTAIN_TASK_DEFINITION],
    };

    const totalTicks = 120 * HOURS_PER_DAY;
    const ctx: EngineRunContext = {};

    for (let tick = 0; tick < totalTicks; tick += 1) {
      const { world: nextWorld } = runTick(world, ctx);
      world = nextWorld;
    }

    const finalStructure = world.company.structures[0];
    const finalZone = finalStructure.rooms[0].zones[0];
    const finalDevice = finalZone.devices[0];

    expect(finalDevice.condition01).toBeGreaterThanOrEqual(0);
    expect(finalDevice.condition01).toBeLessThanOrEqual(1);

    const maintenance = finalDevice.maintenance;
    expect(maintenance).toBeDefined();
    expect(maintenance?.completedServiceCount ?? 0).toBeGreaterThan(0);

    const expectedCost = computeExpectedMaintenanceCost(totalTicks, MAINTENANCE_POLICY, finalDevice.quality01);
    const actualCost = maintenance?.totalMaintenanceCostCc ?? 0;

    expect(actualCost).toBeCloseTo(expectedCost, 2);
  });
});
