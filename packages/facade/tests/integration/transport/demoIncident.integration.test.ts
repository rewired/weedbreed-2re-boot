/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it, vi } from 'vitest';

import {
  createDemoScenario,
  createEngineBootstrapConfig,
  type Plant,
  type SimulationWorld,
} from '@wb/engine';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { shouldAutoPauseForIncident } from '../../../src/transport/incidentTelemetry.js';

const COOL_AIR_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';
const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';

async function prepareIncidentWorld(): Promise<SimulationWorld> {
  let world = createDemoScenario({ companyName: 'Incident Grow', seed: 'incident-flow' });
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((entry) => entry.purpose === 'growroom');
  const zone = room?.zones[0];
  if (!structure || !room || !zone) throw new Error('Demo grow targets missing.');

  const installed = createEngineCommandPipeline({
    world: { get: () => world, set: (next) => { world = next; } },
  });
  await installed.handle({
    type: 'device.purchaseInstall.v1',
    intentId: '40000000-0000-4000-8000-000000000001',
    structureId: structure.id,
    roomId: room.id,
    zoneId: zone.id,
    deviceBlueprintId: COOL_AIR_ID,
  });

  const currentZone = world.company.structures[0]?.rooms
    .find((entry) => entry.id === room.id)?.zones.find((entry) => entry.id === zone.id);
  if (!currentZone) throw new Error('Installed demo zone missing.');

  const plant: Plant = {
    id: '40000000-0000-4000-8000-000000000002' as Plant['id'],
    slug: 'incident-plant',
    name: 'Incident Plant',
    strainId: NORTHERN_LIGHTS_ID as Plant['strainId'],
    lifecycleStage: 'vegetative',
    ageHours: 0,
    health01: 1,
    biomass_g: 1,
    containerId: currentZone.containerId,
    substrateId: currentZone.substrateId,
    readyForHarvest: false,
    status: 'active',
    moisture01: 0.5,
    quality01: 1,
  };

  const structures = world.company.structures.map((candidateStructure) => ({
    ...candidateStructure,
    rooms: candidateStructure.rooms.map((candidateRoom) => ({
      ...candidateRoom,
      zones: candidateRoom.zones.map((candidateZone) => candidateZone.id === currentZone.id
        ? { ...candidateZone, plants: [plant] }
        : candidateZone),
    })),
  }));
  return { ...world, company: { ...world.company, structures } };
}

describe('R-400 authoritative demo incident journey', () => {
  it('projects active and resolved state around the existing climate intent and a real tick', async () => {
    let world = await prepareIncidentWorld();
    let isPlaying = true;
    const events: { topic: string; payload: unknown }[] = [];
    const setWorld = vi.fn((next: SimulationWorld) => { world = next; });
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: setWorld },
      context: {
        telemetry: {
          emit(topic, payload) {
            events.push({ topic, payload });
            if (shouldAutoPauseForIncident(topic, payload)) isPlaying = false;
          },
        },
      },
    });
    const providers = createReadModelProviders({
      world: () => world,
      companyWorld: () => world.company,
      config: createEngineBootstrapConfig('demo'),
      playbackState: () => ({ isPlaying, speedMultiplier: 1 }),
    });

    pipeline.advanceTick();
    pipeline.advanceTick();
    pipeline.advanceTick();

    const activeSnapshot = await providers.readModels();
    const active = activeSnapshot.simulation.pendingIncidents[0];
    expect(activeSnapshot.simulation.paused).toBe(true);
    expect(active).toMatchObject({
      code: 'demo.environment.temperature_high',
      status: 'active',
      measured: { metric: 'temperature_C', value: 32 },
      consequence: {
        code: 'plant_heat_stress',
        affectedPlantCount: 1,
      },
      recommendedIntent: { type: 'intent.zone.climate.adjust.v1' },
      resolvedAtTick: null,
    });
    expect(active?.targetBand.min).toBeLessThan(active?.targetBand.max ?? 0);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        topic: 'telemetry.demo.environment.incident.v1',
        payload: expect.objectContaining({ status: 'active' }),
      }),
    ]));

    if (!active) throw new Error('Active incident projection missing.');
    const ack = await pipeline.handle({
      type: active.recommendedIntent.type,
      ...active.recommendedIntent.payload,
    });
    expect(ack).toMatchObject({ ok: true, status: 'queued' });
    pipeline.advanceTick();

    const resolvedSnapshot = await providers.readModels();
    const resolvedZone = world.company.structures.flatMap((entry) => entry.rooms)
      .flatMap((entry) => entry.zones).find((entry) => entry.id === active.zoneId);
    expect(
      world.demoIncident?.status,
      JSON.stringify({ temperature: resolvedZone?.environment.airTemperatureC, devices: resolvedZone?.devices }),
    ).toBe('resolved');
    expect(resolvedSnapshot.simulation.paused).toBe(true);
    expect(resolvedSnapshot.simulation.pendingIncidents[0]).toMatchObject({
      status: 'resolved',
      severity: 'info',
      resolvedAtTick: 4,
    });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        topic: 'telemetry.demo.environment.incident.v1',
        payload: expect.objectContaining({ status: 'resolved' }),
      }),
    ]));
  });
});
