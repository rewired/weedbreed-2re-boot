import { z } from 'zod';

import { AIR_DENSITY_KG_PER_M3, AMBIENT_CO2_PPM } from '../../constants/simConstants.ts';
import type { SimulationWorld, Zone } from '../../domain/entities.ts';
import { parseCompanyWorld } from '../../domain/schemas/company.ts';
import { finiteNumber, nonEmptyString, uuidSchema } from '../../domain/schemas/primitives.ts';
import { isValidArea } from '../../domain/validation/roomsZones.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { loadDemoScenarioBlueprints } from '../../scenarios/demoScenarioBlueprints.ts';
import { findRoom, findStructure, hasEntityId, rejectFacilityCommand } from './helpers.ts';
import type { FacilityMutationResult } from './types.ts';

const zoneCreateSchema = z.object({
  intentId: uuidSchema,
  structureId: uuidSchema,
  roomId: uuidSchema,
  name: nonEmptyString.optional(),
  floorArea_m2: finiteNumber.positive(),
  cultivationMethodId: uuidSchema,
  containerId: uuidSchema,
  substrateId: uuidSchema,
  irrigationMethodId: uuidSchema,
}).strict();

export interface ZoneCreateCommand {
  readonly intentId: string;
  readonly structureId: string;
  readonly roomId: string;
  readonly name?: string;
  readonly floorArea_m2: number;
  readonly cultivationMethodId: string;
  readonly containerId: string;
  readonly substrateId: string;
  readonly irrigationMethodId: string;
}

/** Executes the authoritative `zone.create.v1` world mutation for the demo configuration. */
export function executeZoneCreate(
  world: SimulationWorld,
  command: ZoneCreateCommand,
): FacilityMutationResult {
  const parsed = zoneCreateSchema.safeParse(command);
  if (!parsed.success) {
    return rejectFacilityCommand(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid zone command.');
  }

  const input = parsed.data;
  const entityId = deterministicUuid(world.seed, `facility:zone:${input.intentId}:0`);
  if (hasEntityId(world, entityId)) {
    return { ok: true, world, entityId, replayed: true };
  }

  const structure = findStructure(world, input.structureId);
  if (!structure) {
    return rejectFacilityCommand(world, 'structure_not_found', 'Target structure does not exist.');
  }
  const room = findRoom(structure, input.roomId);
  if (!room) {
    return rejectFacilityCommand(world, 'room_not_found', 'Target room does not exist.');
  }
  if (room.purpose !== 'growroom') {
    return rejectFacilityCommand(world, 'invalid_placement', 'Zones may only be created inside growrooms.');
  }
  if (!isValidArea(input.floorArea_m2)) {
    return rejectFacilityCommand(world, 'invalid_command', 'Zone area must align to AREA_QUANTUM_M2.');
  }
  const usedArea = room.zones.reduce((sum, zone) => sum + zone.floorArea_m2, 0);
  if (input.floorArea_m2 > room.floorArea_m2 - usedArea) {
    return rejectFacilityCommand(world, 'insufficient_capacity', 'Growroom capacity is insufficient for the zone.');
  }

  const blueprints = loadDemoScenarioBlueprints();
  const configurationMatches =
    input.cultivationMethodId === blueprints.cultivationMethod.id &&
    input.containerId === blueprints.container.id &&
    input.substrateId === blueprints.substrate.id &&
    input.irrigationMethodId === blueprints.irrigation.id &&
    blueprints.cultivationMethod.containers.includes(blueprints.container.slug) &&
    blueprints.cultivationMethod.substrates.includes(blueprints.substrate.slug) &&
    blueprints.irrigation.compatibility.substrates.includes(blueprints.substrate.slug);
  if (!configurationMatches) {
    return rejectFacilityCommand(world, 'incompatible_configuration', 'Zone blueprint references are unknown or incompatible.');
  }

  const zone: Zone = {
    id: entityId,
    slug: `zone-${entityId.slice(0, 8)}`,
    name: input.name ?? `Grow Zone ${String(room.zones.length + 1)}`,
    floorArea_m2: input.floorArea_m2,
    height_m: room.height_m,
    cultivationMethodId: input.cultivationMethodId,
    containerId: input.containerId,
    substrateId: input.substrateId,
    irrigationMethodId: input.irrigationMethodId,
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [],
    devices: [],
    airMass_kg: input.floorArea_m2 * room.height_m * AIR_DENSITY_KG_PER_M3,
    environment: { airTemperatureC: 22, relativeHumidity01: 0.55, co2_ppm: AMBIENT_CO2_PPM },
    ppfd_umol_m2s: 0,
    dli_mol_m2d_inc: 0,
    nutrientBuffer_mg: {},
    moisture01: 0.5,
  };
  const nextRoom = { ...room, zones: [...room.zones, zone] };
  const nextStructure = {
    ...structure,
    rooms: structure.rooms.map((entry) => entry.id === room.id ? nextRoom : entry),
  };
  const company = parseCompanyWorld({
    ...world.company,
    structures: world.company.structures.map((entry) => entry.id === structure.id ? nextStructure : entry),
  });

  return { ok: true, world: { ...world, company }, entityId, replayed: false };
}
