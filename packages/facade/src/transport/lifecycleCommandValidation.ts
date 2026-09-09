import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  type DeviceInstance, type Room, type SimulationWorld, type Structure, type Uuid,
  type Zone, type ZoneDeviceInstance, lightScheduleSchema, uuidSchema,
} from '@wb/engine';
import { FLOAT_TOLERANCE } from '@engine/constants/simConstants.js';
import { parseCultivationMethodBlueprint } from '@/backend/src/domain/blueprints/cultivationMethodBlueprint.js';
import { clamp01 } from '@/backend/src/util/math.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CULTIVATION_METHOD_ROOT = path.resolve(
  CURRENT_DIR,
  '../../../../data/blueprints/cultivation-method',
);

interface CultivationMethodGuidance {
  temperature_C?: readonly [number, number];
}

let cultivationGuidanceCache: Map<Uuid, CultivationMethodGuidance> | null = null;

function readCultivationMethodBlueprint(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

function listCultivationMethodBlueprints(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.join(root, entry.name));
      continue;
    }

    if (entry.isDirectory()) {
      const nestedRoot = path.join(root, entry.name);
      const nestedEntries = readdirSync(nestedRoot, { withFileTypes: true });

      for (const nestedEntry of nestedEntries) {
        if (nestedEntry.isFile() && nestedEntry.name.endsWith('.json')) {
          files.push(path.join(nestedRoot, nestedEntry.name));
        }
      }
    }
  }

  return files;
}

function loadCultivationGuidance(): Map<Uuid, CultivationMethodGuidance> {
  if (cultivationGuidanceCache) {
    return cultivationGuidanceCache;
  }

  const guidance = new Map<Uuid, CultivationMethodGuidance>();

  for (const filePath of listCultivationMethodBlueprints(CULTIVATION_METHOD_ROOT)) {
    const blueprint = parseCultivationMethodBlueprint(readCultivationMethodBlueprint(filePath), {
      filePath,
    });

    const ideal = blueprint.idealConditions;
    const entry: CultivationMethodGuidance = {};

    if (ideal?.idealTemperature && ideal.idealTemperature.length === 2) {
      const [min, max] = ideal.idealTemperature;

      if (Number.isFinite(min) && Number.isFinite(max)) {
        entry.temperature_C = [min, max] as readonly [number, number];
      }
    }

    if (entry.temperature_C) {
      guidance.set(blueprint.id as Uuid, entry);
    }
  }

  cultivationGuidanceCache = guidance;
  return guidance;
}

function getCultivationGuidance(cultivationMethodId: Uuid): CultivationMethodGuidance | undefined {
  return loadCultivationGuidance().get(cultivationMethodId);
}

export const hiringMarketScanSchema = z.object({
  structureId: uuidSchema,
});

export const hiringMarketHireSchema = z.object({
  candidate: z.object({
    structureId: uuidSchema,
    candidateId: uuidSchema,
  }),
});

export const workforceRaiseAcceptSchema = z.object({
  employeeId: uuidSchema,
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

export const workforceRaiseBonusSchema = z.object({
  employeeId: uuidSchema,
  bonusAmount_cc: z.number().finite().optional(),
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

export const workforceRaiseIgnoreSchema = z.object({
  employeeId: uuidSchema,
  moralePenalty01: z.number().finite().optional(),
});

export const hrAssignSchema = z.object({
  employeeId: uuidSchema,
  target: uuidSchema,
});

export const pestZoneIntentSchema = z.object({
  zoneId: uuidSchema,
});

export const maintenanceTaskSchema = z.object({
  deviceId: uuidSchema,
});

export const workforceTerminationSchema = z.object({
  employeeId: uuidSchema,
  reasonSlug: z.string().trim().min(1).optional(),
  severanceCc: z.number().finite().optional(),
  moraleRipple01: z.number().finite().optional(),
});

const renameNameSchema = z.string().trim().min(1, 'Name must not be empty.');

export const structureRenameSchema = z.object({
  type: z.literal('intent.structure.rename.v1'),
  structureId: uuidSchema,
  name: renameNameSchema,
});

export const roomRenameSchema = z.object({
  type: z.literal('intent.room.rename.v1'),
  structureId: uuidSchema,
  roomId: uuidSchema,
  name: renameNameSchema,
});

export const zoneRenameSchema = z.object({
  type: z.literal('intent.zone.rename.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  name: renameNameSchema,
});

export const zoneMoveSchema = z.object({
  type: z.literal('intent.zone.move.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  targetRoomId: uuidSchema,
});

export const deviceMoveSchema = z.object({
  type: z.literal('intent.device.move.v1'),
  structureId: uuidSchema,
  deviceId: uuidSchema,
  target: z.discriminatedUnion('scope', [
    z.object({ scope: z.literal('structure') }),
    z.object({ scope: z.literal('room'), roomId: uuidSchema }),
    z.object({ scope: z.literal('zone'), roomId: uuidSchema, zoneId: uuidSchema }),
  ]),
});

export const zoneLightingAdjustSchema = z.object({
  type: z.literal('intent.zone.lighting.adjust.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  lightSchedule: lightScheduleSchema,
});

export const zoneClimateAdjustSchema = z.object({
  type: z.literal('intent.zone.climate.adjust.v1'),
  structureId: uuidSchema,
  zoneId: uuidSchema,
  target: z.object({
    temperature_C: z.number().finite(),
  }),
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

export type LifecycleCommand =
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
    }
  | {
      readonly type: 'zone.adjustLighting';
      readonly structureId: Uuid;
      readonly roomId: Uuid;
      readonly zoneId: Uuid;
      readonly lightSchedule: Zone['lightSchedule'];
    }
  | {
      readonly type: 'zone.adjustClimate';
      readonly structureId: Uuid;
      readonly roomId: Uuid;
      readonly zoneId: Uuid;
      readonly target: { readonly temperature_C: number };
    };

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

function computeLightingCoverage(zone: Zone): number {
  return zone.devices.reduce((total, device) => {
    const hasLightingEffect =
      (device.effects?.includes('lighting') ?? false) || device.effectConfigs?.lighting !== undefined;

    if (!hasLightingEffect) {
      return total;
    }

    const coverage = Number.isFinite(device.coverage_m2) ? device.coverage_m2 : 0;
    const duty = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

    if (coverage <= 0 || duty <= 0) {
      return total;
    }

    return total + coverage * duty;
  }, 0);
}

function ensureZoneLightingCapacity(zone: Zone): void {
  const coverage = computeLightingCoverage(zone);

  if (coverage <= FLOAT_TOLERANCE) {
    throw new Error('Zone lighting coverage is insufficient for schedule adjustments per SEC §6.');
  }
}

interface ThermalCapacity {
  readonly heating_W: number;
  readonly cooling_W: number;
}

function computeThermalCapacity(devices: readonly ZoneDeviceInstance[]): ThermalCapacity {
  let heating_W = 0;
  let cooling_W = 0;

  for (const device of devices) {
    const duty = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

    if (duty <= 0) {
      continue;
    }

    const hasThermalEffect =
      (device.effects?.includes('thermal') ?? false) || device.effectConfigs?.thermal !== undefined;

    if (!hasThermalEffect) {
      continue;
    }

    const config = device.effectConfigs?.thermal;

    if (config) {
      if (typeof config.max_heat_W === 'number') {
        heating_W += Math.max(0, config.max_heat_W) * duty;
      } else if (config.mode === 'heat' || config.mode === 'auto') {
        heating_W += Math.max(0, device.powerDraw_W) * duty * clamp01(device.efficiency01);
      }

      if (typeof config.max_cool_W === 'number') {
        cooling_W += Math.max(0, config.max_cool_W) * duty;
      } else if (config.mode === 'cool' || config.mode === 'auto') {
        const sensible = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
          ? device.sensibleHeatRemovalCapacity_W
          : 0;

        if (sensible > 0) {
          cooling_W += sensible * duty;
        }
      }
    } else {
      heating_W += Math.max(0, device.powerDraw_W) * duty * clamp01(device.efficiency01);

      const sensible = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
        ? device.sensibleHeatRemovalCapacity_W
        : 0;

      if (sensible > 0) {
        cooling_W += sensible * duty;
      }
    }
  }

  return { heating_W, cooling_W } satisfies ThermalCapacity;
}

function validateTemperatureTarget(zone: Zone, targetTemperatureC: number): void {
  const guidance = getCultivationGuidance(zone.cultivationMethodId);

  if (guidance?.temperature_C) {
    const [min, max] = guidance.temperature_C;

    if (targetTemperatureC + FLOAT_TOLERANCE < min || targetTemperatureC - FLOAT_TOLERANCE > max) {
      throw new Error('Requested temperature setpoint violates cultivation method guidance.');
    }
  }

  const { heating_W, cooling_W } = computeThermalCapacity(zone.devices);
  const current = zone.environment.airTemperatureC;

  if (targetTemperatureC > current + FLOAT_TOLERANCE && heating_W <= FLOAT_TOLERANCE) {
    throw new Error('Zone lacks heating capacity to raise temperature per SEC §6.');
  }

  if (targetTemperatureC < current - FLOAT_TOLERANCE && cooling_W <= FLOAT_TOLERANCE) {
    throw new Error('Zone lacks cooling capacity to lower temperature per SEC §6.');
  }
}

export function createStructureRenameCommand(
  payload: z.infer<typeof structureRenameSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  return { type: 'structure.rename', structureId: structure.id, name: payload.name.trim() };
}

export function createRoomRenameCommand(
  payload: z.infer<typeof roomRenameSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const room = requireRoom(structure, payload.roomId);
  return { type: 'room.rename', structureId: structure.id, roomId: room.id, name: payload.name.trim() };
}

export function createZoneRenameCommand(
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

export function createZoneMoveCommand(
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

export function createDeviceMoveCommand(
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

export function createZoneLightingAdjustCommand(
  payload: z.infer<typeof zoneLightingAdjustSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const { room, zone } = requireZone(structure, payload.zoneId);

  ensureZoneLightingCapacity(zone);

  return {
    type: 'zone.adjustLighting',
    structureId: structure.id,
    roomId: room.id,
    zoneId: zone.id,
    lightSchedule: payload.lightSchedule,
  } satisfies LifecycleCommand;
}

export function createZoneClimateAdjustCommand(
  payload: z.infer<typeof zoneClimateAdjustSchema>,
  world: SimulationWorld,
): LifecycleCommand {
  const structure = requireStructure(world, payload.structureId);
  const { room, zone } = requireZone(structure, payload.zoneId);

  const targetTemperature = payload.target.temperature_C;
  validateTemperatureTarget(zone, targetTemperature);

  return {
    type: 'zone.adjustClimate',
    structureId: structure.id,
    roomId: room.id,
    zoneId: zone.id,
    target: { temperature_C: targetTemperature },
  } satisfies LifecycleCommand;
}
