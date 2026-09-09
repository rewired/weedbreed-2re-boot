/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  createDemoScenario,
  hashSaveGameWorld,
  type SimulationWorld,
} from '@wb/engine';
import {
  createJourneyProgress,
  createSessionIntentHandler,
  reconcileJourneyProgress,
  type JourneyProgress,
  type SessionEnvelope,
} from '../../../src/intents/session/index.js';
import type { TransportAck, TransportIntentEnvelope } from '../../../src/transport/adapter.js';
import {
  createSimulationControlIntentHandler,
} from '../../../src/transport/devServer.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { createPlaybackController } from '../../../src/transport/playbackController.js';

const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const SOUR_DIESEL_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2';
const LED_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const COOL_AIR_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';
const MAX_GROW_TICKS = 4_000;

const fixedIntentId = (sequence: number): string =>
  `90000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;

export interface JourneyTraceEntry {
  readonly type: string;
  readonly intentId: string | null;
  readonly atSimTimeHours: number;
  readonly repeat?: number;
}

export interface JourneyReplayResult {
  readonly dailyWorldHashes: readonly { readonly day: number; readonly hash: string }[];
  readonly finalWorldHash: string;
  readonly eventCount: number;
  readonly milestoneCount: number;
  readonly finalSimTimeHours: number;
  readonly trace: readonly JourneyTraceEntry[];
}

function requireResult<T>(ack: TransportAck | void): T {
  if (!ack || ack.ok !== true || !('result' in ack)) throw new Error('Journey intent acknowledgement missing.');
  return ack.result as T;
}

function locateDemo(world: SimulationWorld) {
  const structure = world.company.structures[0];
  const growroom = structure?.rooms.find((room) => room.purpose === 'growroom');
  const laboratory = structure?.rooms.find((room) => room.purpose === 'laboratory');
  const zones = growroom?.zones ?? [];
  if (!structure || !growroom || !laboratory || zones.length !== 2) {
    throw new Error('Canonical journey facility is incomplete.');
  }
  return { structure, growroom, laboratory, zones };
}

/** Executes the release journey exclusively through facade intents and canonical hourly ticks. */
export async function runDeterministicJourneyReplay(): Promise<JourneyReplayResult> {
  let world = createDemoScenario({ companyName: 'Replay Bootstrap', seed: 'replay-bootstrap' });
  let journeyProgress: JourneyProgress = createJourneyProgress();
  let eventCount = 0;
  const dailyWorldHashes: { day: number; hash: string }[] = [];
  const trace: JourneyTraceEntry[] = [];
  const pipeline = createEngineCommandPipeline({
    world: { get: () => world, set: (next) => { world = next; } },
    context: { telemetry: { emit() { eventCount += 1; } } },
    beforeWorldReplace() { journeyProgress = createJourneyProgress(); },
  });
  const playback = createPlaybackController({
    pipeline,
    autoStart: false,
    onTick() {
      journeyProgress = reconcileJourneyProgress(journeyProgress, world);
      if (world.simTimeHours % 24 === 0) {
        dailyWorldHashes.push({ day: world.simTimeHours / 24, hash: hashSaveGameWorld(world) });
      }
    },
  });
  const control = createSimulationControlIntentHandler({
    playback,
    parseSpeedMultiplier: (intent) => Number(intent.multiplier),
  });
  const session = createSessionIntentHandler({
    getWorld: () => world,
    getPlayback: () => ({ status: 'paused', speedMultiplier: 1 }),
    getJourneyProgress: () => journeyProgress,
    replace: (state) => { world = state.world; journeyProgress = state.journeyProgress; },
  });

  const submit = async (intent: TransportIntentEnvelope): Promise<TransportAck | void> => {
    trace.push({
      type: intent.type,
      intentId: typeof intent.intentId === 'string' ? intent.intentId : null,
      atSimTimeHours: world.simTimeHours,
    });
    const sessionAck = intent.type === 'session.save.v1' || intent.type === 'session.load.v1'
      ? await session(intent)
      : undefined;
    if (sessionAck) return sessionAck;
    const controlAck = control(intent);
    if (controlAck) {
      journeyProgress = reconcileJourneyProgress(journeyProgress, world);
      return controlAck;
    }
    const ack = await pipeline.handle(intent);
    journeyProgress = reconcileJourneyProgress(journeyProgress, world);
    return ack;
  };

  const advanceUntil = async (label: string, predicate: () => boolean): Promise<void> => {
    const start = world.simTimeHours;
    for (let tick = 0; tick < MAX_GROW_TICKS && !predicate(); tick += 1) {
      const ack = control({ type: 'simulation.control.step' });
      if (!ack?.ok) throw new Error(`${label} tick failed.`);
      if (tick % 100 === 99) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
    if (!predicate()) {
      const activePlants = locateDemo(world).zones.flatMap((zone) => zone.plants)
        .filter((plant) => plant.status !== 'harvested')
        .map((plant) => ({
          strainId: plant.strainId, stage: plant.lifecycleStage, ageHours: plant.ageHours,
          ready: plant.readyForHarvest, health01: plant.health01,
        }));
      throw new Error(
        `${label} did not complete within ${String(MAX_GROW_TICKS)} ticks: ${JSON.stringify(activePlants)}`,
      );
    }
    trace.push({
      type: 'simulation.control.step', intentId: null,
      atSimTimeHours: start, repeat: world.simTimeHours - start,
    });
  };

  try {
    await submit({
      type: 'game.new.v1', intentId: fixedIntentId(1),
      companyName: 'Deterministic Replay Labs', seed: 'integration-seed',
    });
    let targets = locateDemo(world);
    for (const [zoneIndex, zone] of targets.zones.entries()) {
      for (let deviceIndex = 0; deviceIndex < 7; deviceIndex += 1) {
        await submit({
          type: 'device.purchaseInstall.v1', intentId: fixedIntentId(10 + zoneIndex * 10 + deviceIndex),
          structureId: targets.structure.id, roomId: targets.growroom.id,
          zoneId: zone.id, deviceBlueprintId: LED_ID,
        });
      }
      await submit({
        type: 'device.purchaseInstall.v1', intentId: fixedIntentId(17 + zoneIndex * 10),
        structureId: targets.structure.id, roomId: targets.growroom.id,
        zoneId: zone.id, deviceBlueprintId: COOL_AIR_ID,
      });
    }
    targets = locateDemo(world);
    await submit({
      type: 'plants.sow.v1', intentId: fixedIntentId(31),
      structureId: targets.structure.id, roomId: targets.growroom.id,
      zoneId: targets.zones[0]!.id, strainId: NORTHERN_LIGHTS_ID, count: 2,
    });
    await submit({
      type: 'plants.sow.v1', intentId: fixedIntentId(32),
      structureId: targets.structure.id, roomId: targets.growroom.id,
      zoneId: targets.zones[1]!.id, strainId: SOUR_DIESEL_ID, count: 2,
    });
    for (const zone of targets.zones) {
      await submit({
        type: 'intent.zone.lighting.adjust.v1', structureId: targets.structure.id,
        zoneId: zone.id, lightSchedule: { onHours: 12, offHours: 12, startHour: 0 },
      });
    }
    await advanceUntil('incident trigger', () => world.demoIncident?.status === 'active');
    const incident = world.demoIncident;
    if (!incident) throw new Error('Canonical incident did not trigger.');
    await submit({
      type: 'intent.zone.climate.adjust.v1', structureId: targets.structure.id,
      zoneId: incident.zoneId,
      target: { temperature_C: (incident.targetBandC[0] + incident.targetBandC[1]) / 2 },
    });
    await advanceUntil('incident resolution', () => world.demoIncident?.status === 'resolved');
    await advanceUntil('parent grow', () => locateDemo(world).zones.every((zone) =>
      zone.plants.filter((plant) => plant.status !== 'harvested').every((plant) => plant.readyForHarvest === true)
    ));

    targets = locateDemo(world);
    const parentLotIds: string[] = [];
    for (const [zoneIndex, zone] of targets.zones.entries()) {
      const plantIds = zone.plants.filter((plant) => plant.status !== 'harvested').map((plant) => plant.id).sort();
      const harvest = requireResult<{ readonly lotIds: readonly string[] }>(await submit({
        type: 'plants.harvest.v1', intentId: fixedIntentId(40 + zoneIndex),
        structureId: targets.structure.id, roomId: targets.growroom.id, zoneId: zone.id, plantIds,
      }));
      parentLotIds.push(...harvest.lotIds);
    }
    await submit({
      type: 'inventory.sell.v1', intentId: fixedIntentId(42), lotId: parentLotIds[0]!, fraction01: 0.5,
    });
    const cross = requireResult<{ readonly runId: string; readonly candidateIds: readonly string[] }>(await submit({
      type: 'breeding.crossF1.v1', intentId: fixedIntentId(43),
      laboratoryRoomId: targets.laboratory.id,
      seedParentId: NORTHERN_LIGHTS_ID, pollenParentId: SOUR_DIESEL_ID, populationSize: 4,
    }));
    const selectedCandidateId = cross.candidateIds[0]!;
    await submit({
      type: 'breeding.selectCandidate.v1', intentId: fixedIntentId(44),
      runId: cross.runId, candidateId: selectedCandidateId, name: 'Replay One',
    });
    await submit({
      type: 'plants.sow.v1', intentId: fixedIntentId(45),
      structureId: targets.structure.id, roomId: targets.growroom.id,
      zoneId: targets.zones[0]!.id, strainId: selectedCandidateId, count: 1,
    });
    await submit({
      type: 'intent.zone.lighting.adjust.v1', structureId: targets.structure.id,
      zoneId: targets.zones[0]!.id,
      lightSchedule: { onHours: 12, offHours: 12, startHour: 0 },
    });
    const selectedBlueprint = world.breeding?.customStrainRegistry.find((strain) =>
      strain.id === selectedCandidateId
    );
    const selectedFlowerTemperature = selectedBlueprint?.envBands.flower?.temp_C
      ?? selectedBlueprint?.envBands.default.temp_C;
    if (!selectedFlowerTemperature) throw new Error('Selected F1 temperature band is missing.');
    await submit({
      type: 'intent.zone.climate.adjust.v1', structureId: targets.structure.id,
      zoneId: targets.zones[0]!.id,
      target: {
        temperature_C: (selectedFlowerTemperature.green[0] + selectedFlowerTemperature.green[1]) / 2,
      },
    });
    await advanceUntil('selected F1 grow', () => locateDemo(world).zones[0]!.plants.some((plant) =>
      plant.strainId === selectedCandidateId && plant.status !== 'harvested' && plant.readyForHarvest === true
    ));
    targets = locateDemo(world);
    const f1PlantIds = targets.zones[0]!.plants.filter((plant) =>
      plant.strainId === selectedCandidateId && plant.status !== 'harvested' && plant.readyForHarvest === true
    ).map((plant) => plant.id);
    await submit({
      type: 'plants.harvest.v1', intentId: fixedIntentId(46),
      structureId: targets.structure.id, roomId: targets.growroom.id,
      zoneId: targets.zones[0]!.id, plantIds: f1PlantIds,
    });
    journeyProgress = reconcileJourneyProgress(journeyProgress, world);
    const save = requireResult<{ readonly session: SessionEnvelope }>(await submit({
      type: 'session.save.v1', intentId: fixedIntentId(47),
    }));
    return {
      dailyWorldHashes,
      finalWorldHash: save.session.worldHash,
      eventCount,
      milestoneCount: save.session.journeyProgress.milestones.length,
      finalSimTimeHours: world.simTimeHours,
      trace,
    };
  } finally {
    playback.dispose();
  }
}
