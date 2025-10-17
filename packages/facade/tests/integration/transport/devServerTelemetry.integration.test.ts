import { describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_TICK_COMPLETED_V1,
  TELEMETRY_ZONE_SNAPSHOT_V1,
} from '@/backend/src/telemetry/topics.ts';
import type { Plant, Room, Zone } from '@/backend/src/domain/world.ts';

import {
  INTENT_EVENT,
  TELEMETRY_EVENT,
  type TelemetryEvent,
  type TransportAck,
} from '../../../src/transport/adapter.ts';
import { startFacadeDevServer } from '../../../src/transport/devServer.ts';
import { onceConnected, disconnectClient } from './helpers.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function prepareHarvestReadyWorld(): ReturnType<typeof createDemoWorld> {
  const world = createDemoWorld();
  const structure = (world.company.structures[0] ?? null) as Mutable<
    ReturnType<typeof createDemoWorld>['company']['structures'][0]
  > | null;

  if (!structure) {
    throw new Error('Demo world missing base structure.');
  }

  const growRoom = structure.rooms.find((room) => room.purpose === 'growroom') as Mutable<Room> | undefined;

  if (!growRoom) {
    throw new Error('Demo world missing growroom.');
  }

  const zone = (growRoom.zones[0] ?? null) as Mutable<Zone> | null;

  if (!zone) {
    throw new Error('Demo world missing cultivation zone.');
  }

  const harvestReadyPlant: Plant = {
    id: '00000000-0000-4000-8000-000000000010' as Plant['id'],
    name: 'Demo Harvest Plant',
    slug: 'demo-harvest-plant',
    strainId: '550e8400-e29b-41d4-a716-446655440001' as Plant['strainId'],
    lifecycleStage: 'harvest-ready',
    ageHours: 0,
    health01: 0.88,
    biomass_g: 480,
    containerId: zone.containerId,
    substrateId: zone.substrateId,
    readyForHarvest: true,
    status: 'active',
    moisture01: 0.6,
    quality01: 0.85,
  } satisfies Plant;

  zone.plants = [harvestReadyPlant];

  return world;
}

async function createClientForNamespace(serverUrl: string, namespace: string): Promise<Socket> {
  const socket = createClient(`${serverUrl}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await onceConnected(socket);

  return socket;
}

describe('facade transport dev server telemetry bridge', () => {
  it('forwards engine telemetry envelopes to connected clients', async () => {
    const world = prepareHarvestReadyWorld();
    const structure = world.company.structures[0];
    const growRoom = structure.rooms.find((room) => room.purpose === 'growroom');
    const storageRoom = structure.rooms.find((room) => room.purpose === 'storageroom');
    const zone = growRoom?.zones[0];

    if (!structure || !growRoom || !storageRoom || !zone) {
      throw new Error('Demo world preparation failed: missing required geometry.');
    }

    const plantId = zone.plants[0]?.id;
    if (!plantId) {
      throw new Error('Prepared harvest plant is missing an id.');
    }

    const devServer = await startFacadeDevServer({
      host: '127.0.0.1',
      port: 0,
      world,
    });

    let telemetryClient: Socket | null = null;
    let intentsClient: Socket | null = null;

    try {
      telemetryClient = await createClientForNamespace(devServer.server.url, '/telemetry');
      intentsClient = await createClientForNamespace(devServer.server.url, '/intents');

      const receivedEvents: TelemetryEvent[] = [];

      const telemetryEventPromise = new Promise<TelemetryEvent>((resolve, reject) => {
        const timeout = setTimeout(() => {
          telemetryClient?.off(TELEMETRY_EVENT, handleTelemetryEvent);
          reject(new Error('Timed out waiting for telemetry:event payload.'));
        }, 5000);

        function handleTelemetryEvent(event: TelemetryEvent) {
          receivedEvents.push(event);

          if (event.topic !== TELEMETRY_HARVEST_CREATED_V1) {
            return;
          }

          telemetryClient?.off(TELEMETRY_EVENT, handleTelemetryEvent);
          clearTimeout(timeout);
          resolve(event);
        }

        telemetryClient?.on(TELEMETRY_EVENT, handleTelemetryEvent);

        telemetryClient?.once('connect_error', (error) => {
          telemetryClient?.off(TELEMETRY_EVENT, handleTelemetryEvent);
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });

      const ackPromise = new Promise<TransportAck>((resolve) => {
        intentsClient?.emit(
          INTENT_EVENT,
          { type: 'hiring.market.scan', structureId: structure.id },
          (response: TransportAck) => {
            resolve(response);
          },
        );
      });

      const [telemetryEvent, ack] = await Promise.all([telemetryEventPromise, ackPromise]);

      expect(ack).toEqual({ ok: true });
      expect(telemetryEvent.topic).toBe(TELEMETRY_HARVEST_CREATED_V1);

      const payload = telemetryEvent.payload as Record<string, unknown>;

      expect(payload).toMatchObject({
        structureId: structure.id,
        roomId: storageRoom.id,
        zoneId: zone.id,
        plantId,
        createdAt_tick: 0,
        freshWeight_kg: 0.48,
        moisture01: 0.6,
        quality01: 0.85,
      });

      expect(typeof payload.lotId).toBe('string');

      const tickEvent = receivedEvents.find((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(tickEvent).toBeDefined();
      const tickPayload = (tickEvent?.payload ?? {}) as Record<string, unknown>;
      expect(tickPayload.simTimeHours).toBeCloseTo(1, 6);
      expect(tickPayload.targetTicksPerHour).toBeCloseTo(1, 6);
      expect(tickPayload.actualTicksPerHour).toBeCloseTo(1, 6);

      const zoneSnapshot = receivedEvents.find((event) => event.topic === TELEMETRY_ZONE_SNAPSHOT_V1);
      expect(zoneSnapshot).toBeDefined();
      const zonePayload = (zoneSnapshot?.payload ?? {}) as Record<string, unknown>;
      expect(zonePayload.zoneId).toBe(zone.id);
      expect(zonePayload.simTime).toBeCloseTo(world.simTimeHours, 6);
      expect(Array.isArray(zonePayload.warnings)).toBe(true);
    } finally {
      if (intentsClient) {
        await disconnectClient(intentsClient);
      }

      if (telemetryClient) {
        await disconnectClient(telemetryClient);
      }

      await devServer.stop();
    }
  });
});

