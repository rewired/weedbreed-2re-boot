/* eslint-disable wb-sim/no-ts-import-js-extension */
import { z } from 'zod';
import type { SimulationWorld, WorkforceIntent } from '@wb/engine';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { queueWorkforceIntents } from '@/backend/src/engine/pipeline/applyWorkforce.js';
import type { TransportAck, TransportIntentEnvelope } from './adapter.js';
import { type LifecycleCommand, structureRenameSchema, roomRenameSchema, zoneRenameSchema,
  zoneMoveSchema, deviceMoveSchema, zoneLightingAdjustSchema, zoneClimateAdjustSchema,
  createStructureRenameCommand, createRoomRenameCommand, createZoneRenameCommand,
  createZoneMoveCommand, createDeviceMoveCommand, createZoneLightingAdjustCommand,
  createZoneClimateAdjustCommand,
} from './lifecycleCommandValidation.js';
import {
  applyLifecycleCommand,
  applyLifecycleCommands,
  toLifecycleAck,
} from './lifecycleCommandState.js';
import { createWorkforceAckOverlay, toWorkforceIntent } from './workforceCommands.js';
import { createGameCommandHandler } from './gameCommands.js';
import { createFacilityIntentHandler } from '../intents/facility/handler.js';
import { createPlantsIntentHandler } from '../intents/plants/handler.js';
import { createInventoryIntentHandler } from '../intents/inventory/handler.js';
import { createBreedingIntentHandler } from '../intents/breeding/handler.js';

/**
 * Runtime contract consumed by {@link createEngineCommandPipeline} to access and mutate the
 * backing simulation world. The façade dev transport server wires this against the demo
 * harness world to keep intent forwarding deterministic.
 */
export interface EngineWorldAccess {
  /** Returns the current simulation world snapshot. */
  readonly get: () => SimulationWorld;
  /** Persists the next simulation world snapshot after processing an intent. */
  readonly set: (world: SimulationWorld) => void;
}

/**
 * Options accepted by {@link createEngineCommandPipeline}.
 */
export interface EngineCommandPipelineOptions {
  /** Read/write accessors for the simulation world handled by the façade. */
  readonly world: EngineWorldAccess;
  /** Optional engine run context shared across ticks. Defaults to an empty context. */
  readonly context?: EngineRunContext;
  /** Pauses playback and performs other session-bound resets before a new world is published. */
  readonly beforeWorldReplace?: (world: SimulationWorld) => void | Promise<void>;
  /** Test seam for the engine's canonical demo scenario builder. */
  readonly createDemoScenario?: (input: {
    readonly companyName: string;
    readonly seed: string;
  }) => SimulationWorld;
}

/**
 * Runtime command pipeline that normalises transport intents and forwards them to the engine.
 */
export interface EngineCommandPipeline {
  /** Engine execution context reused across intent submissions. */
  readonly context: EngineRunContext;
  /**
   * Normalises and queues the provided transport intent before the next simulation tick.
   *
   * @throws {Error} When the intent type is unsupported or fails validation.
   */
  handle(intent: TransportIntentEnvelope): Promise<TransportAck | void>;
  /**
   * Advances the simulation by one deterministic tick, applying all queued intents.
   */
  advanceTick(): void;
  /** Atomically replaces a loaded world after discarding all staged commands and acknowledgement caches. */
  replaceWorld(world: SimulationWorld): void;
  /** Returns the current authoritative world, including any staged lifecycle mutation. */
  getWorld(): SimulationWorld;
}

type EngineCommand =
  | { readonly kind: 'workforce'; readonly intent: WorkforceIntent }
  | { readonly kind: 'lifecycle'; readonly command: LifecycleCommand };

function normaliseIntent(
  envelope: TransportIntentEnvelope,
  world: SimulationWorld,
): EngineCommand {
  try {
    switch (envelope.type) {
      case 'intent.structure.rename.v1': {
        const payload = structureRenameSchema.parse(envelope);
        return { kind: 'lifecycle', command: createStructureRenameCommand(payload, world) };
      }
      case 'intent.room.rename.v1': {
        const payload = roomRenameSchema.parse(envelope);
        return { kind: 'lifecycle', command: createRoomRenameCommand(payload, world) };
      }
      case 'intent.zone.rename.v1': {
        const payload = zoneRenameSchema.parse(envelope);
        return { kind: 'lifecycle', command: createZoneRenameCommand(payload, world) };
      }
      case 'intent.zone.move.v1': {
        const payload = zoneMoveSchema.parse(envelope);
        return { kind: 'lifecycle', command: createZoneMoveCommand(payload, world) };
      }
      case 'intent.device.move.v1': {
        const payload = deviceMoveSchema.parse(envelope);
        return { kind: 'lifecycle', command: createDeviceMoveCommand(payload, world) };
      }
      case 'intent.zone.lighting.adjust.v1': {
        const payload = zoneLightingAdjustSchema.parse(envelope);
        return { kind: 'lifecycle', command: createZoneLightingAdjustCommand(payload, world) };
      }
      case 'intent.zone.climate.adjust.v1': {
        const payload = zoneClimateAdjustSchema.parse(envelope);
        return { kind: 'lifecycle', command: createZoneClimateAdjustCommand(payload, world) };
      }
      default: {
        const intent = toWorkforceIntent(envelope);

        if (!intent) {
          throw new Error(`Unsupported intent type: ${envelope.type}`);
        }

        return { kind: 'workforce', intent } satisfies EngineCommand;
      }
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => issue.message).join('; ');
      throw new Error(`Intent payload failed validation: ${issues}`);
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Creates an engine-backed command pipeline that translates transport intents into engine
 * intents before advancing the simulation by one deterministic tick per submission.
 */
export function createEngineCommandPipeline(
  options: EngineCommandPipelineOptions,
): EngineCommandPipeline {
  const context: EngineRunContext = options.context ?? {};
  let pendingWorkforceIntents: WorkforceIntent[] = [];
  let pendingLifecycleCommands: LifecycleCommand[] = [];
  let stagedWorld: SimulationWorld | null = null;
  const facilityWorldAccess = {
    get: () => stagedWorld ?? options.world.get(),
    set: (world: SimulationWorld) => {
      options.world.set(world);
      pendingLifecycleCommands = [];
      stagedWorld = null;
    },
  };
  const plantWorldAccess = {
    get: () => stagedWorld ?? options.world.get(),
    set: (world: SimulationWorld) => {
      options.world.set(world);
      pendingLifecycleCommands = [];
      stagedWorld = null;
    },
    emitTelemetry: (topic: string, payload: Record<string, unknown>) => context.telemetry?.emit(topic, payload),
  };
  const inventoryWorldAccess = {
    get: () => stagedWorld ?? options.world.get(),
    set: (world: SimulationWorld) => {
      options.world.set(world);
      pendingLifecycleCommands = [];
      stagedWorld = null;
    },
  };
  const breedingWorldAccess = {
    get: () => stagedWorld ?? options.world.get(),
    set: (world: SimulationWorld) => {
      options.world.set(world);
      pendingLifecycleCommands = [];
      stagedWorld = null;
    },
  };
  const gameCommandOptions = {
    setWorld: options.world.set,
    createScenario: options.createDemoScenario,
    beforeWorldReplace: options.beforeWorldReplace,
  };
  let facilityIntents = createFacilityIntentHandler(facilityWorldAccess);
  let plantIntents = createPlantsIntentHandler(plantWorldAccess);
  let inventoryIntents = createInventoryIntentHandler(inventoryWorldAccess);
  let breedingIntents = createBreedingIntentHandler(breedingWorldAccess);
  let gameCommands = createGameCommandHandler(gameCommandOptions);

  const resetHandlers = (): void => {
    facilityIntents = createFacilityIntentHandler(facilityWorldAccess);
    plantIntents = createPlantsIntentHandler(plantWorldAccess);
    inventoryIntents = createInventoryIntentHandler(inventoryWorldAccess);
    breedingIntents = createBreedingIntentHandler(breedingWorldAccess);
    gameCommands = createGameCommandHandler(gameCommandOptions);
  };

  return {
    context,
    async handle(envelope: TransportIntentEnvelope): Promise<TransportAck | void> {
      if (envelope.type === 'game.new.v1') {
        try {
          const acknowledgement = await gameCommands.handle(envelope);
          pendingWorkforceIntents = [];
          pendingLifecycleCommands = [];
          stagedWorld = null;
          return acknowledgement;
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => issue.message).join('; ');
            throw new Error(`Intent payload failed validation: ${issues}`);
          }

          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      if (
        envelope.type === 'room.create.v1' ||
        envelope.type === 'zone.create.v1' ||
        envelope.type === 'device.purchaseInstall.v1'
      ) {
        try {
          return await facilityIntents(envelope);
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => issue.message).join('; ');
            throw new Error(`Intent payload failed validation: ${issues}`);
          }

          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      if (envelope.type === 'plants.sow.v1' || envelope.type === 'plants.harvest.v1') {
        try {
          return await plantIntents(envelope);
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => issue.message).join('; ');
            throw new Error(`Intent payload failed validation: ${issues}`);
          }

          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      if (envelope.type === 'inventory.sell.v1') {
        try {
          return await inventoryIntents(envelope);
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => issue.message).join('; ');
            throw new Error(`Intent payload failed validation: ${issues}`);
          }
          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      if (envelope.type === 'breeding.crossF1.v1' || envelope.type === 'breeding.selectCandidate.v1') {
        try {
          return await breedingIntents(envelope);
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => issue.message).join('; ');
            throw new Error(`Intent payload failed validation: ${issues}`);
          }
          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      const baseWorld = stagedWorld ?? options.world.get();
      const command = normaliseIntent(envelope, baseWorld);

      if (command.kind === 'workforce') {
        const ackOverlay = createWorkforceAckOverlay(baseWorld, command.intent);
        pendingWorkforceIntents = [...pendingWorkforceIntents, command.intent];
        return ackOverlay;
      }

      pendingLifecycleCommands = [...pendingLifecycleCommands, command.command];
      stagedWorld = applyLifecycleCommand(baseWorld, command.command);
      return toLifecycleAck(command.command);
    },
    advanceTick(): void {
      let worldSnapshot = stagedWorld ?? options.world.get();

      if (!stagedWorld && pendingLifecycleCommands.length > 0) {
        worldSnapshot = applyLifecycleCommands(worldSnapshot, pendingLifecycleCommands);
      }

      pendingLifecycleCommands = [];
      stagedWorld = null;

      const intentsToApply = pendingWorkforceIntents;
      pendingWorkforceIntents = [];

      if (intentsToApply.length > 0) {
        queueWorkforceIntents(context, intentsToApply);
      }

      const { world: nextWorld } = runTick(worldSnapshot, context);
      options.world.set(nextWorld);
    },
    replaceWorld(world): void {
      pendingWorkforceIntents = [];
      pendingLifecycleCommands = [];
      stagedWorld = null;
      resetHandlers();
      options.world.set(world);
    },
    getWorld(): SimulationWorld {
      return stagedWorld ?? options.world.get();
    },
  } satisfies EngineCommandPipeline;
}
