import { describe, expect, it } from 'vitest';

import {
  mDegrade,
  mMaintenance,
  updateZoneDeviceLifecycle,
} from '@/backend/src/device/degradation.js';
import type {
  DeviceMaintenancePolicy,
  DeviceMaintenanceState,
  Room,
  Structure,
  Zone,
  ZoneDeviceInstance,
  Uuid,
} from '@/backend/src/domain/world.js';

const STRUCTURE_ID = '00000000-0000-4000-8000-000000000010' as Uuid;
const ROOM_ID = '00000000-0000-4000-8000-000000000011' as Uuid;
const ZONE_ID = '00000000-0000-4000-8000-000000000012' as Uuid;
const DEVICE_ID = '00000000-0000-4000-8000-000000000013' as Uuid;
const BLUEPRINT_ID = '00000000-0000-4000-8000-000000000014' as Uuid;

function createStructure(): Structure {
  const room = createRoom();
  return {
    id: STRUCTURE_ID,
    slug: 'test-structure',
    name: 'Test Structure',
    floorArea_m2: 100,
    height_m: 3,
    devices: [],
    rooms: [room],
  } satisfies Structure;
}

function createRoom(): Room {
  const zone = createZone();
  return {
    id: ROOM_ID,
    slug: 'test-room',
    name: 'Test Room',
    purpose: 'growroom',
    floorArea_m2: 50,
    height_m: 3,
    devices: [],
    zones: [zone],
  } satisfies Room;
}

function createZone(): Zone {
  return {
    id: ZONE_ID,
    slug: 'test-zone',
    name: 'Test Zone',
    floorArea_m2: 20,
    height_m: 3,
    cultivationMethodId: '00000000-0000-4000-8000-000000000020' as Uuid,
    irrigationMethodId: '00000000-0000-4000-8000-000000000021' as Uuid,
    containerId: '00000000-0000-4000-8000-000000000022' as Uuid,
    substrateId: '00000000-0000-4000-8000-000000000023' as Uuid,
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [],
    devices: [],
    airMass_kg: 100,
    environment: {
      airTemperatureC: 22,
      relativeHumidity_pct: 55,
      co2_ppm: 400,
    },
    ppfd_umol_m2s: 0,
    dli_mol_m2d_inc: 0,
    nutrientBuffer_mg: {},
    moisture01: 0.5,
  } satisfies Zone;
}

function createPolicy(): DeviceMaintenancePolicy {
  return {
    lifetimeHours: 10_000,
    maintenanceIntervalHours: 100,
    serviceHours: 2,
    restoreAmount01: 0.1,
    baseCostPerHourCc: 0.01,
    costIncreasePer1000HoursCc: 0.002,
    serviceVisitCostCc: 35,
    replacementCostCc: 400,
    maintenanceConditionThreshold01: 0.5,
  } satisfies DeviceMaintenancePolicy;
}

function createDevice(maintenance?: DeviceMaintenanceState): ZoneDeviceInstance {
  return {
    id: DEVICE_ID,
    slug: 'test-device',
    name: 'Test Device',
    blueprintId: BLUEPRINT_ID,
    placementScope: 'zone',
    quality01: 0.8,
    condition01: 0.9,
    powerDraw_W: 150,
    dutyCycle01: 1,
    efficiency01: 0.85,
    coverage_m2: 12,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0,
    maintenance,
  } satisfies ZoneDeviceInstance;
}

describe('mDegrade', () => {
  it('decreases wear factor as quality improves', () => {
    expect(mDegrade(0.2)).toBeGreaterThan(mDegrade(0.8));
    expect(mDegrade(0.5)).toBeGreaterThan(0);
    expect(mDegrade(0.5)).toBeLessThanOrEqual(1);
  });
});

describe('mMaintenance', () => {
  it('decreases maintenance demand as quality improves', () => {
    expect(mMaintenance(0.2)).toBeGreaterThan(mMaintenance(0.9));
    expect(mMaintenance(0.6)).toBeLessThanOrEqual(1);
  });
});

describe('updateZoneDeviceLifecycle', () => {
  it('reduces condition and accrues cost deterministically', () => {
    const policy = createPolicy();
    const maintenance: DeviceMaintenanceState = {
      runtimeHours: 0,
      hoursSinceService: 0,
      totalMaintenanceCostCc: 0,
      completedServiceCount: 0,
      recommendedReplacement: false,
      policy,
    } satisfies DeviceMaintenanceState;

    const structure = createStructure();
    const room = structure.rooms[0] as Room;
    const zone = { ...room.zones[0], devices: [] } as Zone;
    const device = createDevice(maintenance);

    const outcome = updateZoneDeviceLifecycle({
      device,
      structure,
      room,
      zone,
      workshopRoom: undefined,
      seed: 'test-seed',
      tickHours: 1,
      currentTick: 0,
    });

    expect(outcome.device.condition01).toBeLessThan(device.condition01);
    expect(outcome.device.maintenance?.runtimeHours).toBeGreaterThan(0);
    expect(outcome.costAccruedCc).toBeGreaterThan(0);
    expect(outcome.scheduledTask).toBeUndefined();
  });

  it('schedules maintenance when interval is exceeded', () => {
    const policy = createPolicy();
    const maintenance: DeviceMaintenanceState = {
      runtimeHours: 0,
      hoursSinceService: policy.maintenanceIntervalHours / mMaintenance(0.8) + 1,
      totalMaintenanceCostCc: 0,
      completedServiceCount: 0,
      recommendedReplacement: false,
      policy,
    } satisfies DeviceMaintenanceState;

    const structure = createStructure();
    const room = structure.rooms[0] as Room;
    const zone = { ...room.zones[0], devices: [] } as Zone;
    const device = createDevice(maintenance);

    const outcome = updateZoneDeviceLifecycle({
      device,
      structure,
      room,
      zone,
      workshopRoom: room,
      seed: 'maintenance-seed',
      tickHours: 1,
      currentTick: 120,
    });

    expect(outcome.scheduledTask).toBeDefined();
    expect(outcome.device.maintenance?.maintenanceWindow).toBeDefined();
  });

  it('emits replacement recommendation when cost exceeds threshold', () => {
    const policy = createPolicy();
    const maintenance: DeviceMaintenanceState = {
      runtimeHours: 2_000,
      hoursSinceService: 10,
      totalMaintenanceCostCc: policy.replacementCostCc - 0.001,
      completedServiceCount: 1,
      recommendedReplacement: false,
      policy,
    } satisfies DeviceMaintenanceState;

    const structure = createStructure();
    const room = structure.rooms[0] as Room;
    const zone = { ...room.zones[0], devices: [] } as Zone;
    const device = createDevice(maintenance);

    const outcome = updateZoneDeviceLifecycle({
      device,
      structure,
      room,
      zone,
      workshopRoom: room,
      seed: 'replacement-seed',
      tickHours: 1,
      currentTick: 200,
    });

    expect(outcome.replacementJustRecommended).toBeDefined();
    expect(outcome.device.maintenance?.recommendedReplacement).toBe(true);
  });
});
