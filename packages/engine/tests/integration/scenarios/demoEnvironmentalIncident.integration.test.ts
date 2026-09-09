import { describe, expect, it } from 'vitest';

import {
  DEMO_ENVIRONMENT_INCIDENT_TEMPERATURE_C,
  TELEMETRY_DEMO_ENVIRONMENT_INCIDENT_V1,
  applyDemoEnvironmentalIncident,
  createDemoScenario,
  executeDevicePurchaseInstall,
  runTick,
  type Plant,
  type SimulationWorld,
  type Zone,
} from '@wb/engine';
import { deterministicUuid } from '@/backend/src/util/uuid';

const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const CLIMATE_BLUEPRINT_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';
const LIGHT_BLUEPRINT_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';

function withPlant(world: SimulationWorld): SimulationWorld {
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((candidate) => candidate.purpose === 'growroom');
  const zone = room?.zones[0];
  if (!structure || !room || !zone) throw new Error('Demo zone missing.');
  const plant: Plant = {
    id: deterministicUuid(world.seed, 'incident-test:plant'),
    slug: 'incident-test-plant',
    name: 'Incident Test Plant',
    strainId: NORTHERN_LIGHTS_ID as Plant['strainId'],
    lifecycleStage: 'seedling',
    ageHours: 0,
    health01: 1,
    biomass_g: 1,
    containerId: zone.containerId,
    substrateId: zone.substrateId,
    status: 'active',
  };
  const plantedZone: Zone = {
    ...zone,
    plants: [plant],
    ppfd_umol_m2s: 500,
    dli_mol_m2d_inc: 1.8,
  };
  return {
    ...world,
    company: {
      ...world.company,
      structures: [{
        ...structure,
        rooms: room === structure.rooms[0]
          ? [{ ...room, zones: [plantedZone, ...room.zones.slice(1)] }, ...structure.rooms.slice(1)]
          : structure.rooms.map((candidate) => candidate.id === room.id
            ? { ...candidate, zones: [plantedZone, ...candidate.zones.slice(1)] }
            : candidate),
      }],
    },
  };
}

function findZone(world: SimulationWorld, zoneId: string): Zone {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      const zone = room.zones.find((candidate) => candidate.id === zoneId);
      if (zone) return zone;
    }
  }
  throw new Error('Incident zone missing.');
}

function runToIncident(world: SimulationWorld) {
  const events: { topic: string; payload: Record<string, unknown> }[] = [];
  const ctx = { telemetry: { emit: (topic: string, payload: Record<string, unknown>) => events.push({ topic, payload }) } };
  let current = world;
  for (let index = 0; index < 3; index += 1) current = runTick(current, ctx).world;
  return { world: current, events };
}

function withDemoDevices(world: SimulationWorld, zoneId: Zone['id']): SimulationWorld {
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((candidate) => candidate.zones.some((zone) => zone.id === zoneId));
  if (!structure || !room) throw new Error('Incident scope missing.');
  let installedWorld = world;
  const blueprintIds = [
    ...Array.from({ length: 7 }, () => LIGHT_BLUEPRINT_ID),
    CLIMATE_BLUEPRINT_ID,
  ];
  for (const [index, deviceBlueprintId] of blueprintIds.entries()) {
    const installed = executeDevicePurchaseInstall(installedWorld, {
      intentId: deterministicUuid(world.seed, `incident-test:install:${String(index)}`),
      structureId: structure.id,
      roomId: room.id,
      zoneId,
      deviceBlueprintId,
    });
    if (!installed.ok) throw new Error(installed.message);
    installedWorld = installed.world;
  }
  return installedWorld;
}

function withClimateSetpoint(world: SimulationWorld, zoneId: Zone['id'], targetC: number): SimulationWorld {
  const installedZone = findZone(world, zoneId);
  const devices = installedZone.devices.map((device) => ({
    ...device,
    ...(device.effectConfigs?.thermal
      && (typeof device.effectConfigs.thermal.max_cool_W === 'number'
        || typeof device.effectConfigs.thermal.max_heat_W === 'number')
      ? {
          effectConfigs: {
            ...device.effectConfigs,
            thermal: { ...device.effectConfigs.thermal, setpoint_C: targetC },
          },
        }
      : {}),
  }));
  const nextZone = { ...installedZone, devices } satisfies Zone;
  return replaceZone(world, nextZone);
}

function replaceZone(world: SimulationWorld, replacement: Zone): SimulationWorld {
  return {
    ...world,
    company: {
      ...world.company,
      structures: world.company.structures.map((structure) => ({
        ...structure,
        rooms: structure.rooms.map((room) => ({
          ...room,
          zones: room.zones.map((zone) => zone.id === replacement.id ? replacement : zone),
        })),
      })),
    },
  };
}

describe('game.new.v1 demo environmental incident', () => {
  it('is deterministic for custom demo seeds, occurs once, and emits the frozen payload', () => {
    const first = runToIncident(withPlant(createDemoScenario({ companyName: 'Demo', seed: 'custom-seed' })));
    const second = runToIncident(withPlant(createDemoScenario({ companyName: 'Demo', seed: 'custom-seed' })));

    expect(second.world).toStrictEqual(first.world);
    expect(first.world.demoIncident).toMatchObject({
      code: 'demo.environment.temperature_high',
      status: 'active',
      triggeredAtSimTimeHours: 3,
      measuredTemperatureC: DEMO_ENVIRONMENT_INCIDENT_TEMPERATURE_C,
      consequence: 'plant_heat_stress',
      recommendedIntent: 'intent.zone.climate.adjust.v1',
    });
    const incidentEvents = first.events.filter(({ topic }) => topic === TELEMETRY_DEMO_ENVIRONMENT_INCIDENT_V1);
    expect(incidentEvents).toHaveLength(1);
    expect(incidentEvents[0]?.payload).toMatchObject({
      incidentCode: 'demo.environment.temperature_high',
      status: 'active',
      simTimeHours: 3,
      measuredTemperatureC: 32,
      targetBandC: { minC: 18, maxC: 24 },
    });

    const later = runTick(first.world, {}).world;
    expect(later.demoIncident?.triggeredAtSimTimeHours).toBe(3);
  });

  it('resolves after one climate-adjusted tick and protects physiology', () => {
    const plantedWorld = withPlant(createDemoScenario({ companyName: 'Demo', seed: 'compare-seed' }));
    const plantedZone = plantedWorld.company.structures[0]?.rooms[0]?.zones[0];
    if (!plantedZone) throw new Error('Planted zone missing.');
    const incidentWorld = runToIncident(withDemoDevices(plantedWorld, plantedZone.id)).world;
    const incident = incidentWorld.demoIncident;
    if (!incident) throw new Error('Incident missing.');
    const targetC = (incident.targetBandC[0] + incident.targetBandC[1]) / 2;
    const treatedInput = withClimateSetpoint(incidentWorld, incident.zoneId, targetC);
    const climateDevice = findZone(treatedInput, incident.zoneId).devices
      .find((device) => device.slug === 'cool-air-split-3000');
    expect(climateDevice?.effectConfigs?.thermal?.setpoint_C).toBe(targetC);
    const resolvedEvents: { topic: string; payload: Record<string, unknown> }[] = [];
    const treated = runTick(treatedInput, {
      telemetry: { emit: (topic, payload) => resolvedEvents.push({ topic, payload }) },
    }).world;
    const untreated = runTick(incidentWorld, {}).world;
    const treatedZone = findZone(treated, incident.zoneId);
    const untreatedZone = findZone(untreated, incident.zoneId);

    expect(treatedZone.environment.airTemperatureC).toBe(targetC);
    expect(treated.demoIncident).toMatchObject({ status: 'resolved', resolvedAtSimTimeHours: 4 });
    expect(resolvedEvents.filter(({ topic }) => topic === TELEMETRY_DEMO_ENVIRONMENT_INCIDENT_V1)).toHaveLength(1);
    expect(treatedZone.plants[0]?.health01).toBeGreaterThan(untreatedZone.plants[0]?.health01 ?? 0);
    expect(treatedZone.plants[0]?.biomass_g).toBeGreaterThan(untreatedZone.plants[0]?.biomass_g ?? 0);
  });

  it('does not affect non-demo worlds or empty demo worlds', () => {
    const emptyDemo = createDemoScenario({ companyName: 'Empty', seed: 'empty-seed' });
    const atTrigger = { ...emptyDemo, simTimeHours: 2 };
    expect(applyDemoEnvironmentalIncident(atTrigger)).toBe(atTrigger);
    const nonDemo = { ...withPlant(emptyDemo), scenarioId: undefined, simTimeHours: 2 };
    expect(applyDemoEnvironmentalIncident(nonDemo)).toBe(nonDemo);
  });
});
