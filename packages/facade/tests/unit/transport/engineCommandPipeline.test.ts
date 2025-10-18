import { describe, expect, it } from 'vitest';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { DEFAULT_WORKFORCE_CONFIG } from '@/backend/src/config/workforce.ts';
import { consumeWorkforceMarketCharges } from '@/backend/src/engine/pipeline/applyWorkforce.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import { createDeterministicWorld } from '@wb/facade/backend/deterministicWorldLoader';

import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

describe('createEngineCommandPipeline', () => {
  it('queues hiring market intents and advances the engine world', async () => {
    const initialWorld = createDemoWorld();
    let world = initialWorld;

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    const structureId = initialWorld.company.structures[0]?.id;
    if (!structureId) {
      throw new Error('Demo world did not include a structure id for hiring intents.');
    }

    await pipeline.handle({ type: 'hiring.market.scan', structureId });
    pipeline.advanceTick();

    const charges = consumeWorkforceMarketCharges(pipeline.context);
    expect(charges).toBeDefined();
    expect(charges).not.toHaveLength(0);
    expect(charges?.[0]).toMatchObject({
      structureId,
      amountCc: DEFAULT_WORKFORCE_CONFIG.market.scanCost_cc,
    });

    expect(world.workforce.market.structures).not.toEqual(
      initialWorld.workforce.market.structures,
    );
  });

  it('renames structures after the queued tick commits', async () => {
    let world = createDeterministicWorld().world;
    const structure = world.company.structures[0];
    if (!structure) {
      throw new Error('Deterministic world did not include a structure.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await pipeline.handle({
      type: 'intent.structure.rename.v1',
      structureId: structure.id,
      name: 'Renamed Demo Facility',
    });

    pipeline.advanceTick();

    const renamedStructure = world.company.structures.find((entry) => entry.id === structure.id);
    expect(renamedStructure?.name).toBe('Renamed Demo Facility');
  });

  it('rejects zone moves into non-growroom targets', async () => {
    let world = createDeterministicWorld().world;
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const storageRoom = structure?.rooms.find((room) => room.purpose === 'storageroom');
    const zone = growRoom?.zones[0];

    if (!structure || !growRoom || !storageRoom || !zone) {
      throw new Error('Deterministic world lacks expected rooms/zones for the move validation test.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await expect(
      pipeline.handle({
        type: 'intent.zone.move.v1',
        structureId: structure.id,
        zoneId: zone.id,
        targetRoomId: storageRoom.id,
      }),
    ).rejects.toThrow(/growroom/i);
  });

  it('moves zones into eligible growrooms', async () => {
    let world = createDeterministicWorld().world;
    const structure = world.company.structures[0];
    const sourceRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const zone = sourceRoom?.zones[0];

    if (!structure || !sourceRoom || !zone) {
      throw new Error('Deterministic world lacks expected growroom data for zone move tests.');
    }

    const targetRoom = {
      ...sourceRoom,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Expansion Grow Room',
      zones: [],
      devices: [],
    } as typeof sourceRoom;

    structure.rooms = [...structure.rooms, targetRoom];

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await pipeline.handle({
      type: 'intent.zone.move.v1',
      structureId: structure.id,
      zoneId: zone.id,
      targetRoomId: targetRoom.id,
    });

    pipeline.advanceTick();

    const movedZoneSourceRoom = world.company.structures[0]?.rooms.find((room) => room.id === sourceRoom.id);
    const movedZoneTargetRoom = world.company.structures[0]?.rooms.find((room) => room.id === targetRoom.id);

    expect(movedZoneSourceRoom?.zones.some((entry) => entry.id === zone.id)).toBe(false);
    expect(movedZoneTargetRoom?.zones.some((entry) => entry.id === zone.id)).toBe(true);
  });

  it('rejects unsupported intent types', async () => {
    const initialWorld = createDemoWorld();
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => initialWorld,
        set() {
          throw new Error('set should not be called for unsupported intents');
        },
      },
    });

    await expect(
      pipeline.handle({ type: 'unknown.intent', attempt: true }),
    ).rejects.toThrow(/Unsupported intent type/i);
  });

  it('rejects malformed workforce payloads with validation errors', async () => {
    let world = createDemoWorld();
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    await expect(
      pipeline.handle({ type: 'hiring.market.scan' }),
    ).rejects.toThrow(/failed validation/i);
  });

  it('applies lighting and climate adjustments with deterministic acknowledgements', async () => {
    const seeded = createDeterministicWorld();
    let world = seeded.world;
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const zoneWithLightingAndThermal = growRoom?.zones.find((candidate) => {
      const devices = candidate.devices;
      const hasLighting = devices.some(
        (device) => (device.effects?.includes('lighting') ?? false) || device.effectConfigs?.lighting !== undefined,
      );
      const hasThermal = devices.some(
        (device) => (device.effects?.includes('thermal') ?? false) || device.effectConfigs?.thermal !== undefined,
      );

      return hasLighting && hasThermal;
    });

    if (!structure || !growRoom || !zoneWithLightingAndThermal) {
      throw new Error('Deterministic world lacks growroom climate context for environment adjustments.');
    }

    const baselineTemperature = zoneWithLightingAndThermal.environment.airTemperatureC;
    const zone = zoneWithLightingAndThermal;

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    const nextSchedule = { onHours: 20, offHours: 4, startHour: 2 } as const;
    const lightingAck = await pipeline.handle({
      type: 'intent.zone.lighting.adjust.v1',
      structureId: structure.id,
      zoneId: zone.id,
      lightSchedule: nextSchedule,
    });

    expect(lightingAck).toMatchObject({
      ok: true,
      result: {
        command: 'zone.adjustLighting',
        structureId: structure.id,
        zoneId: zone.id,
        lightSchedule: nextSchedule,
      },
    });

    const climateAck = await pipeline.handle({
      type: 'intent.zone.climate.adjust.v1',
      structureId: structure.id,
      zoneId: zone.id,
      target: { temperature_C: baselineTemperature + 2 },
    });

    expect(climateAck).toMatchObject({
      ok: true,
      result: {
        command: 'zone.adjustClimate',
        structureId: structure.id,
        zoneId: zone.id,
        targetTemperature_C: baselineTemperature + 2,
      },
    });

    pipeline.advanceTick();

    const updatedZone = world.company.structures[0]?.rooms
      .find((room) => room.id === growRoom.id)
      ?.zones.find((candidate) => candidate.id === zone.id);

    expect(updatedZone?.lightSchedule).toEqual(nextSchedule);
    const thermalDevice = updatedZone?.devices.find((device) => device.effectConfigs?.thermal);
    expect(thermalDevice?.effectConfigs?.thermal?.setpoint_C).toBeCloseTo(baselineTemperature + 2, 5);
  });

  it('lowers zone temperature when cooling capacity is available', async () => {
    const seeded = createDeterministicWorld();
    let world = seeded.world;
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const zoneWithThermal = growRoom?.zones.find((candidate) =>
      candidate.devices.some(
        (device) => (device.effects?.includes('thermal') ?? false) || device.effectConfigs?.thermal !== undefined,
      ),
    );

    if (!structure || !growRoom || !zoneWithThermal) {
      throw new Error('Deterministic world lacks growroom climate context for cooling validation.');
    }

    const baselineTemperature = zoneWithThermal.environment.airTemperatureC;

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    const targetTemperature = baselineTemperature - 2;
    const climateAck = await pipeline.handle({
      type: 'intent.zone.climate.adjust.v1',
      structureId: structure.id,
      zoneId: zoneWithThermal.id,
      target: { temperature_C: targetTemperature },
    });

    expect(climateAck).toMatchObject({
      ok: true,
      result: {
        command: 'zone.adjustClimate',
        structureId: structure.id,
        zoneId: zoneWithThermal.id,
        targetTemperature_C: targetTemperature,
      },
    });

    pipeline.advanceTick();

    const updatedZone = world.company.structures[0]?.rooms
      .find((room) => room.id === growRoom.id)
      ?.zones.find((candidate) => candidate.id === zoneWithThermal.id);

    const thermalDevice = updatedZone?.devices.find((device) => device.effectConfigs?.thermal);
    expect(thermalDevice?.effectConfigs?.thermal?.setpoint_C).toBeCloseTo(targetTemperature, 5);
  });

  it('rejects lighting adjustments when a zone lacks lighting coverage', async () => {
    const seeded = createDeterministicWorld();
    let world = seeded.world;
    const structure = world.company.structures[0];
    const growRoomIndex = structure?.rooms.findIndex((room) => room.purpose === 'growroom') ?? -1;
    const growRoom = structure?.rooms[growRoomIndex];

    const lightingSourceZone = growRoom.zones.find((candidate) =>
      candidate.devices.some(
        (device) => (device.effects?.includes('lighting') ?? false) || device.effectConfigs?.lighting !== undefined,
      ),
    );

    if (!structure || !growRoom || !lightingSourceZone || growRoomIndex === -1) {
      throw new Error('Deterministic world lacks growroom context for lighting validation.');
    }

    const lightingStrippedZone = {
      ...lightingSourceZone,
      devices: lightingSourceZone.devices.filter((device) => {
        const hasLighting =
          (device.effects?.includes('lighting') ?? false) || device.effectConfigs?.lighting !== undefined;
        return !hasLighting;
      }),
    } as typeof lightingSourceZone;

    const updatedGrowRoom = {
      ...growRoom,
      zones: growRoom.zones.map((candidate) =>
        candidate.id === lightingStrippedZone.id ? lightingStrippedZone : candidate,
      ),
    } as typeof growRoom;

    structure.rooms = structure.rooms.map((room, index) =>
      index === growRoomIndex ? updatedGrowRoom : room,
    ) as typeof structure.rooms;

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    await expect(
      pipeline.handle({
        type: 'intent.zone.lighting.adjust.v1',
        structureId: structure.id,
        zoneId: lightingStrippedZone.id,
        lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
      }),
    ).rejects.toThrow(/lighting coverage/i);
  });

  it('rejects climate adjustments outside cultivation method guidance', async () => {
    const seeded = createDeterministicWorld();
    let world = seeded.world;
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const SOG_METHOD_ID = '659ba4d7-a5fc-482e-98d4-b614341883ac';
    const zone = growRoom?.zones.find((candidate) => candidate.cultivationMethodId === SOG_METHOD_ID);

    if (!structure || !growRoom || !zone) {
      throw new Error('Deterministic world lacks cultivation guidance context for climate validation.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    await expect(
      pipeline.handle({
        type: 'intent.zone.climate.adjust.v1',
        structureId: structure.id,
        zoneId: zone.id,
        target: { temperature_C: 40 },
      }),
    ).rejects.toThrow(/temperature setpoint violates cultivation method guidance/i);
  });

  it('rejects climate adjustments when a zone lacks cooling devices', async () => {
    const seeded = createDeterministicWorld();
    let world = seeded.world;
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const zoneWithoutCooling = growRoom?.zones.find((candidate) => {
      const hasLighting = candidate.devices.some(
        (device) => (device.effects?.includes('lighting') ?? false) || device.effectConfigs?.lighting !== undefined,
      );
      const hasCooling = candidate.devices.some((device) => {
        const thermal = device.effectConfigs?.thermal;

        if (thermal) {
          if (typeof thermal.max_cool_W === 'number' && thermal.max_cool_W > 0) {
            return true;
          }

          return thermal.mode === 'cool' || thermal.mode === 'auto';
        }

        const sensible = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
          ? device.sensibleHeatRemovalCapacity_W
          : 0;

        return sensible > 0;
      });

      return hasLighting && !hasCooling;
    });

    if (!structure || !growRoom || !zoneWithoutCooling) {
      throw new Error('Deterministic world lacks lighting-only zone for climate validation.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    const baselineTemperature = zoneWithoutCooling.environment.airTemperatureC;
    const MIN_GUIDANCE_TEMPERATURE_C = 21;
    const targetTemperature = Math.max(MIN_GUIDANCE_TEMPERATURE_C + 0.25, baselineTemperature - 0.5);

    if (targetTemperature >= baselineTemperature) {
      throw new Error('Deterministic world climate baseline insufficient for cooling validation.');
    }

    await expect(
      pipeline.handle({
        type: 'intent.zone.climate.adjust.v1',
        structureId: structure.id,
        zoneId: zoneWithoutCooling.id,
        target: { temperature_C: targetTemperature },
      }),
    ).rejects.toThrow(/lacks cooling capacity/i);
  });
});

