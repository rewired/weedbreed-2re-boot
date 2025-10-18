import { z } from 'zod';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  type DeviceInstance,
  type Room,
  type SimulationWorld,
  type Structure,
  type Uuid,
  type WorkforceIntent,
  type Zone,
  uuidSchema,
} from '@wb/engine';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.ts';
import { queueWorkforceIntents } from '@/backend/src/engine/pipeline/applyWorkforce.ts';

import type { TransportIntentEnvelope } from './adapter.js';

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
  handle(intent: TransportIntentEnvelope): Promise<void>;
  /**
   * Advances the simulation by one deterministic tick, applying all queued intents.
   */
  advanceTick(): void;
}

const hiringMarketScanSchema = z.object({
  structureId: uuidSchema,
});

const hiringMarketHireSchema = z.object({
  candidate: z.object({
    structureId: uuidSchema,
    candidateId: uuidSchema,
  }),
});

const workforceRaiseAcceptSchema = z.object({
  employeeId: uuidSchema,
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

const workforceRaiseBonusSchema = z.object({
  employeeId: uuidSchema,
  bonusAmount_cc: z.number().finite().optional(),
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

const workforceRaiseIgnoreSchema = z.object({
  employeeId: uuidSchema,
  moralePenalty01: z.number().finite().optional(),
});

const workforceTerminationSchema = z.object({
  employeeId: uuidSchema,
  reasonSlug: z.string().trim().min(1).optional(),
  severanceCc: z.number().finite().optional(),
  moraleRipple01: z.number().finite().optional(),
});

const renameNameSchema = z.string().trim().min(1, 'Name must not be empty.');

const structureRenameSchema = z.object({
  type: z.literal('intent.structure.rename.v1'),
  structureId: uuidSchema,
  name: renameNameSchema,
});

const roomRenameSchema = z.object({
  type: z.literal('intent.room.rename.v1'),
  structureId: uuidSchema,
  roomId: uuidSchema,
  name: renameNameSchema,
});

const zoneRenameSchema = z.object({
  type: z.literal('intent.zone.rename.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  name: renameNameSchema,
});

const zoneMoveSchema = z.object({
  type: z.literal('intent.zone.move.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  targetRoomId: uuidSchema,
});

const deviceMoveSchema = z.object({
  type: z.literal('intent.device.move.v1'),
  structureId: uuidSchema,
  deviceId: uuidSchema,
  target: z.discriminatedUnion('scope', [
    z.object({ scope: z.literal('structure') }),
    z.object({ scope: z.literal('room'), roomId: uuidSchema }),
    z.object({ scope: z.literal('zone'), roomId: uuidSchema, zoneId: uuidSchema }),
  ]),
});

interface DeviceLocation {
  readonly scope: 'structure' | 'room' | 'zone';
  readonly roomId?: Uuid;
  readonly zoneId?: Uuid;
}

type DeviceTarget =
  | { readonly scope: 'structure' }
  | { readonly scope: 'room'; readonly roomId: Uuid }
  | { readonly scope: 'zone'; readonly roomId: Uuid; readonly zoneId: Uuid };

type LifecycleCommand =
  | { readonly type: 'structure.rename'; readonly structureId: Uuid; readonly name: string }
  | { readonly type: 'room.rename'; readonly structureId: Uuid; readonly roomId: Uuid; readonly name: string }
  | { readonly type: 'zone.rename'; readonly structureId: Uuid; readonly roomId: Uuid; readonly zoneId: Uuid; readonly name: string }
  | {
      readonly type: 'zone.move';
      readonly structureId: Uuid;
      readonly zoneId: Uuid;
      readonly fromRoomId: Uuid;
      readonly toRoomId: Uuid;
      readonly zone: Zone;
    }
  | {
      readonly type: 'device.move';
      readonly structureId: Uuid;
      readonly deviceId: Uuid;
      readonly from: DeviceLocation;
      readonly target: DeviceTarget;
      readonly device: DeviceInstance;
    };

type EngineCommand =
  | { readonly kind: 'workforce'; readonly intent: WorkforceIntent }
  | { readonly kind: 'lifecycle'; readonly command: LifecycleCommand };

function requireStructure(world: SimulationWorld, structureId: Uuid): Structure {
  const structure = world.company.structures.find((candidate) => candidate.id === structureId);

  if (!structure) {
    throw new Error(`Structure ${structureId} not found in the current world snapshot.`);
  }

  return structure;
}

function requireRoom(structure: Structure, roomId: Uuid): Room {
  const room = structure.rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    throw new Error(`Room ${roomId} not found in structure ${structure.id}.`);
  }

  return room;
}

function requireZone(structure: Structure, zoneId: Uuid): { room: Room; zone: Zone } {
  for (const room of structure.rooms) {
    const zone = room.zones.find((candidate) => candidate.id === zoneId);

    if (zone) {
      return { room, zone };
    }
  }

  throw new Error(`Zone ${zoneId} not found in structure ${structure.id}.`);
}

function locateDevice(structure: Structure, deviceId: Uuid): { location: DeviceLocation; device: DeviceInstance } | null {
  const structureDevice = structure.devices.find((device) => device.id === deviceId);

  if (structureDevice) {
    return { location: { scope: 'structure' }, device: structureDevice };
  }

  for (const room of structure.rooms) {
    const roomDevice = room.devices.find((device) => device.id === deviceId);

    if (roomDevice) {
      return { location: { scope: 'room', roomId: room.id }, device: roomDevice };
    }

    for (const zone of room.zones) {
      const zoneDevice = zone.devices.find((device) => device.id === deviceId);

      if (zoneDevice) {
        return {
          location: { scope: 'zone', roomId: room.id, zoneId: zone.id },
          device: zoneDevice,
        };
      }
    }
  }

  return null;
}

function isSameDeviceLocation(from: DeviceLocation, target: DeviceTarget): boolean {
  if (from.scope !== target.scope) {
    return false;
  }

  if (from.scope === 'structure') {
    return true;
  }

  if (from.scope === 'room' && target.scope === 'room') {
    return from.roomId === target.roomId;
  }

  if (from.scope === 'zone' && target.scope === 'zone') {
    return from.roomId === target.roomId && from.zoneId === target.zoneId;
  }

  return false;
}

function createStructureRenameCommand(
  payload: z.infer<typeof structureRenameSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  return { type: 'structure.rename', structureId: structure.id, name: payload.name.trim() };
}

function createRoomRenameCommand(
  payload: z.infer<typeof roomRenameSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const room = requireRoom(structure, payload.roomId);
  return { type: 'room.rename', structureId: structure.id, roomId: room.id, name: payload.name.trim() };
}

function createZoneRenameCommand(
  payload: z.infer<typeof zoneRenameSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const { room } = requireZone(structure, payload.zoneId);
  return {
    type: 'zone.rename',
    structureId: structure.id,
    roomId: room.id,
    zoneId: payload.zoneId,
    name: payload.name.trim(),
  } satisfies LifecycleCommand;
}

function createZoneMoveCommand(
  payload: z.infer<typeof zoneMoveSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const { room: sourceRoom, zone } = requireZone(structure, payload.zoneId);

  if (sourceRoom.purpose !== 'growroom') {
    throw new Error('Zones must originate from growrooms per SEC §2.3.');
  }

  if (sourceRoom.id === payload.targetRoomId) {
    throw new Error('Zone is already assigned to the requested room.');
  }

  const targetRoom = requireRoom(structure, payload.targetRoomId);

  if (targetRoom.purpose !== 'growroom') {
    throw new Error('Target room must be a growroom per SEC §2.3.');
  }

  if (targetRoom.zones.some((candidate) => candidate.id === zone.id)) {
    throw new Error('Target room already hosts the requested zone.');
  }

  const zoneClone = structuredClone(zone) as Zone;

  return {
    type: 'zone.move',
    structureId: structure.id,
    zoneId: zone.id,
    fromRoomId: sourceRoom.id,
    toRoomId: targetRoom.id,
    zone: zoneClone,
  } satisfies LifecycleCommand;
}

function createDeviceMoveCommand(
  payload: z.infer<typeof deviceMoveSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const located = locateDevice(structure, payload.deviceId);

  if (!located) {
    throw new Error(`Device ${payload.deviceId} not found in structure ${structure.id}.`);
  }

  const { location, device } = located;
  const target = payload.target;

  if (isSameDeviceLocation(location, target)) {
    throw new Error('Device is already installed at the requested location.');
  }

  const placementScope = device.placementScope;

  switch (target.scope) {
    case 'structure': {
      if (placementScope !== 'structure') {
        throw new Error('Device placement scope does not allow structure-level installation.');
      }
      break;
    }
    case 'room': {
      if (placementScope !== 'room') {
        throw new Error('Device placement scope does not allow room-level installation.');
      }

      const targetRoom = requireRoom(structure, target.roomId);

      if (targetRoom.purpose !== 'growroom') {
        throw new Error('Target room must be a growroom per SEC §2.3.');
      }
      break;
    }
    case 'zone': {
      if (placementScope !== 'zone') {
        throw new Error('Device placement scope does not allow zone-level installation.');
      }

      const targetRoom = requireRoom(structure, target.roomId);

      if (targetRoom.purpose !== 'growroom') {
        throw new Error('Target room must be a growroom per SEC §2.3.');
      }

      const targetZone = targetRoom.zones.find((candidate) => candidate.id === target.zoneId);

      if (!targetZone) {
        throw new Error(`Zone ${target.zoneId} not found in room ${target.roomId}.`);
      }
      break;
    }
    default: {
      throw new Error(`Unsupported device move scope: ${(target as DeviceTarget).scope}`);
    }
  }

  const deviceClone = structuredClone(device) as DeviceInstance;

  return {
    type: 'device.move',
    structureId: structure.id,
    deviceId: device.id,
    from: location,
    target,
    device: deviceClone,
  } satisfies LifecycleCommand;
}

function applyLifecycleCommand(world: SimulationWorld, command: LifecycleCommand): SimulationWorld {
  switch (command.type) {
    case 'structure.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) =>
            structure.id === command.structureId ? { ...structure, name: command.name } : structure,
          ),
        },
      } satisfies SimulationWorld;
    }

    case 'room.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) =>
                room.id === command.roomId ? { ...room, name: command.name } : room,
              ),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.rename': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            return {
              ...structure,
              rooms: structure.rooms.map((room) => {
                if (room.id !== command.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.zoneId ? { ...zone, name: command.name } : zone,
                  ),
                } satisfies Room;
              }),
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'zone.move': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            let rooms = structure.rooms.map((room) => {
              if (room.id !== command.fromRoomId) {
                return room;
              }

              return {
                ...room,
                zones: room.zones.filter((zone) => zone.id !== command.zoneId),
              } satisfies Room;
            });

            rooms = rooms.map((room) => {
              if (room.id !== command.toRoomId) {
                return room;
              }

              return {
                ...room,
                zones: [...room.zones, command.zone],
              } satisfies Room;
            });

            return {
              ...structure,
              rooms,
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    case 'device.move': {
      return {
        ...world,
        company: {
          ...world.company,
          structures: world.company.structures.map((structure) => {
            if (structure.id !== command.structureId) {
              return structure;
            }

            let structureDevices = structure.devices.filter((device) => device.id !== command.deviceId);
            let rooms = structure.rooms;

            if (command.from.scope === 'room') {
              rooms = rooms.map((room) =>
                room.id === command.from.roomId
                  ? { ...room, devices: room.devices.filter((device) => device.id !== command.deviceId) }
                  : room,
              );
            }

            if (command.from.scope === 'zone') {
              rooms = rooms.map((room) => {
                if (room.id !== command.from.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.from.zoneId
                      ? { ...zone, devices: zone.devices.filter((device) => device.id !== command.deviceId) }
                      : zone,
                  ),
                } satisfies Room;
              });
            }

            if (command.target.scope === 'structure') {
              structureDevices = [...structureDevices, command.device];
            }

            if (command.target.scope === 'room') {
              rooms = rooms.map((room) =>
                room.id === command.target.roomId
                  ? { ...room, devices: [...room.devices, command.device] }
                  : room,
              );
            }

            if (command.target.scope === 'zone') {
              rooms = rooms.map((room) => {
                if (room.id !== command.target.roomId) {
                  return room;
                }

                return {
                  ...room,
                  zones: room.zones.map((zone) =>
                    zone.id === command.target.zoneId
                      ? { ...zone, devices: [...zone.devices, command.device] }
                      : zone,
                  ),
                } satisfies Room;
              });
            }

            return {
              ...structure,
              devices: structureDevices,
              rooms,
            } satisfies Structure;
          }),
        },
      } satisfies SimulationWorld;
    }

    default:
      return world;
  }
}

function applyLifecycleCommands(
  world: SimulationWorld,
  commands: readonly LifecycleCommand[],
): SimulationWorld {
  if (commands.length === 0) {
    return world;
  }

  return commands.reduce<SimulationWorld>(applyLifecycleCommand, world);
}

function toWorkforceIntent(envelope: TransportIntentEnvelope): WorkforceIntent | null {
  switch (envelope.type) {
    case 'hiring.market.scan': {
      const { structureId } = hiringMarketScanSchema.parse(envelope);
      return { type: 'hiring.market.scan', structureId } satisfies WorkforceIntent;
    }

    case 'hiring.market.hire': {
      const { candidate } = hiringMarketHireSchema.parse(envelope);
      return { type: 'hiring.market.hire', candidate } satisfies WorkforceIntent;
    }

    case 'workforce.raise.accept': {
      const { employeeId, rateIncreaseFactor, moraleBoost01 } = workforceRaiseAcceptSchema.parse(envelope);
      return {
        type: 'workforce.raise.accept',
        employeeId,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.bonus': {
      const {
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } = workforceRaiseBonusSchema.parse(envelope);

      return {
        type: 'workforce.raise.bonus',
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.ignore': {
      const { employeeId, moralePenalty01 } = workforceRaiseIgnoreSchema.parse(envelope);
      return {
        type: 'workforce.raise.ignore',
        employeeId,
        moralePenalty01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.employee.terminate': {
      const {
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } = workforceTerminationSchema.parse(envelope);
      return {
        type: 'workforce.employee.terminate',
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } satisfies WorkforceIntent;
    }

    default:
      return null;
  }
}

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

  return {
    context,
    async handle(envelope: TransportIntentEnvelope): Promise<void> {
      const baseWorld = stagedWorld ?? options.world.get();
      const command = normaliseIntent(envelope, baseWorld);

      if (command.kind === 'workforce') {
        pendingWorkforceIntents = [...pendingWorkforceIntents, command.intent];
        return;
      }

      pendingLifecycleCommands = [...pendingLifecycleCommands, command.command];
      stagedWorld = applyLifecycleCommand(baseWorld, command.command);
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
  } satisfies EngineCommandPipeline;
}

