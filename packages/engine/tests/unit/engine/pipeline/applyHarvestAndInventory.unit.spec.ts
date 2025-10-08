import { describe, expect, it } from 'vitest';

import { applyHarvestAndInventory } from '@/backend/src/engine/pipeline/applyHarvestAndInventory';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { createTestPlant } from '@/tests/testUtils/strainFixtures.ts';
import type { EngineDiagnostic, EngineRunContext } from '@/backend/src/engine/Engine';
import type { Plant, Room, Zone } from '@/backend/src/domain/world';
import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1
} from '@/backend/src/telemetry/topics';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface TelemetryEvent {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

function createTelemetryRecorder() {
  const events: TelemetryEvent[] = [];
  return {
    events,
    emit(topic: string, payload: Record<string, unknown>) {
      events.push({ topic, payload });
    }
  };
}

function createDiagnosticsRecorder() {
  const diagnostics: EngineDiagnostic[] = [];
  return {
    diagnostics,
    emit(diagnostic: EngineDiagnostic) {
      diagnostics.push(diagnostic);
    }
  };
}

function prepareHarvestReadyPlant(zone: Mutable<Zone>): Plant {
  const basePlant = zone.plants[0] ?? createTestPlant();
  const plant: Plant = {
    ...basePlant,
    id: '00000000-0000-4000-8000-000000000001' as Plant['id'],
    lifecycleStage: 'harvest-ready',
    biomass_g: 500,
    health01: 0.9,
    moisture01: 0.55,
    quality01: 0.82,
    readyForHarvest: true,
    status: 'active'
  };
  zone.plants = [plant];
  return plant;
}

describe('applyHarvestAndInventory (unit)', () => {
  it('stores harvested plants in the storage room inventory and emits telemetry', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0] as Mutable<typeof world.company.structures[0]>;
    const growRoom = structure.rooms.find((room) => room.purpose === 'growroom') as Mutable<Room>;
    const zone = growRoom.zones[0] as Mutable<Zone>;
    const originalPlant = prepareHarvestReadyPlant(zone);
    const telemetry = createTelemetryRecorder();
    const diagnostics = createDiagnosticsRecorder();
    const ctx: EngineRunContext = { telemetry, diagnostics };

    const nextWorld = applyHarvestAndInventory(world, ctx);
    const nextStructure = nextWorld.company.structures[0];
    const storageRoom = nextStructure.rooms.find((room) => room.inventory);

    expect(storageRoom?.inventory?.lots).toHaveLength(1);
    const lot = storageRoom?.inventory?.lots[0];
    expect(lot?.freshWeight_kg).toBeCloseTo(originalPlant.biomass_g / 1000, 5);
    expect(lot?.quality01).toBeCloseTo(0.82, 5);
    expect(lot?.moisture01).toBeCloseTo(0.55, 5);
    expect(lot?.createdAt_tick).toBe(0);

    const harvestedPlant =
      nextStructure.rooms.find((room) => room.purpose === 'growroom')?.zones[0].plants[0];
    expect(harvestedPlant?.status).toBe('harvested');
    expect(harvestedPlant?.readyForHarvest).toBe(false);
    expect(harvestedPlant?.harvestedAt_tick).toBe(0);

    expect(telemetry.events).toContainEqual(
      expect.objectContaining({ topic: TELEMETRY_HARVEST_CREATED_V1 })
    );
    expect(diagnostics.diagnostics).toHaveLength(0);
  });

  it('skips harvest when no storage room can be resolved', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0] as Mutable<typeof world.company.structures[0]>;
    const growRoom = structure.rooms.find((room) => room.purpose === 'growroom') as Mutable<Room>;
    const zone = growRoom.zones[0] as Mutable<Zone>;
    prepareHarvestReadyPlant(zone);
    const storageRoom = structure.rooms.find((room) => room.class === 'room.storage') as Mutable<Room>;
    storageRoom.class = undefined;
    storageRoom.tags = [];
    storageRoom.inventory = { lots: [] };
    const telemetry = createTelemetryRecorder();
    const diagnostics = createDiagnosticsRecorder();
    const ctx: EngineRunContext = { telemetry, diagnostics };

    const nextWorld = applyHarvestAndInventory(world, ctx);
    const nextStructure = nextWorld.company.structures[0];
    const nextStorage = nextStructure.rooms.find((room) => room.tags?.includes('storage'));

    expect(nextStorage?.inventory?.lots ?? []).toHaveLength(0);
    const plant =
      nextStructure.rooms.find((room) => room.purpose === 'growroom')?.zones[0].plants[0];
    expect(plant?.status).toBe('active');
    expect(plant?.readyForHarvest).toBe(true);

    expect(telemetry.events).toContainEqual(
      expect.objectContaining({ topic: TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1 })
    );
    expect(
      diagnostics.diagnostics.some((diag) => diag.code === 'storage.resolve.not_found')
    ).toBe(true);
  });

  it('produces deterministic lots across runs', () => {
    const createWorld = () => {
      const demo = createDemoWorld();
      const structure = demo.company.structures[0] as Mutable<typeof demo.company.structures[0]>;
      const growRoom = structure.rooms.find((room) => room.purpose === 'growroom') as Mutable<Room>;
      const zone = growRoom.zones[0] as Mutable<Zone>;
      prepareHarvestReadyPlant(zone);
      return demo;
    };

    const telemetryA = createTelemetryRecorder();
    const telemetryB = createTelemetryRecorder();
    const diagnosticsA = createDiagnosticsRecorder();
    const diagnosticsB = createDiagnosticsRecorder();

    const worldA = applyHarvestAndInventory(createWorld(), {
      telemetry: telemetryA,
      diagnostics: diagnosticsA
    });
    const worldB = applyHarvestAndInventory(createWorld(), {
      telemetry: telemetryB,
      diagnostics: diagnosticsB
    });

    const lotA = worldA.company.structures[0].rooms.find((room) => room.inventory)?.inventory?.lots[0];
    const lotB = worldB.company.structures[0].rooms.find((room) => room.inventory)?.inventory?.lots[0];

    expect(lotA).toBeDefined();
    expect(lotB).toBeDefined();
    if (!lotA || !lotB) {
      return;
    }

    expect({ ...lotA, id: undefined }).toEqual({ ...lotB, id: undefined });
    expect(lotA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(lotA.id).toBe(lotB.id);
  });
});
