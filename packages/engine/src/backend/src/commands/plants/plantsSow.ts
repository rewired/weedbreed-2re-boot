import { z } from 'zod';
import strainPricesJson from '../../../../../../../data/prices/strainPrices.json' with { type: 'json' };

import type { Plant, SimulationWorld } from '../../domain/entities.ts';
import type { StrainBlueprint } from '../../domain/blueprints/strainBlueprint.ts';
import { resolveStrain } from '../../domain/blueprints/strainResolver.ts';
import { parseCompanyWorld } from '../../domain/schemas/company.ts';
import { plantSchema } from '../../domain/schemas/plant.ts';
import { uuidSchema } from '../../domain/schemas/primitives.ts';
import { parseStrainPriceMap } from '../../domain/pricing/strainPriceMap.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { postEconomyDebit } from '../../economy/state.ts';
import { assessZoneSowReadiness } from './sowReadiness.ts';
import type {
  DeferredSeedCost,
  PlantsSowErrorCode,
  PlantsSowRejection,
  PlantsSowResult,
} from './types.ts';

const plantsSowSchema = z.object({
  intentId: uuidSchema,
  structureId: uuidSchema,
  roomId: uuidSchema,
  zoneId: uuidSchema,
  strainId: uuidSchema,
  count: z.number().int().positive(),
}).strict();
const STRAIN_PRICES = parseStrainPriceMap(strainPricesJson).strainPrices;
const INITIAL_BIOMASS_G = 1 as const;

/** Input for the authoritative `plants.sow.v1` command. */
export interface PlantsSowCommand {
  readonly intentId: string;
  readonly structureId: string;
  readonly roomId: string;
  readonly zoneId: string;
  readonly strainId: string;
  readonly count: number;
}

function reject(
  world: SimulationWorld,
  code: PlantsSowErrorCode,
  message: string,
): PlantsSowRejection {
  return { ok: false, world, code, message };
}

function isCompatibleWithCultivation(
  blueprint: StrainBlueprint,
  cultivationMethodId: string,
): boolean {
  const affinity = blueprint.methodAffinity;
  if (affinity === undefined) {
    return true;
  }
  if (!affinity || typeof affinity !== 'object' || Array.isArray(affinity)) {
    return false;
  }
  const value = (affinity as Record<string, unknown>)[cultivationMethodId];
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Executes an immutable, deterministic `plants.sow.v1` mutation. */
export function executePlantsSow(
  world: SimulationWorld,
  command: PlantsSowCommand,
): PlantsSowResult {
  const parsed = plantsSowSchema.safeParse(command);
  if (!parsed.success) {
    return reject(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid sow command.');
  }
  const input = parsed.data;
  const structure = world.company.structures.find((entry) => entry.id === input.structureId);
  if (!structure) return reject(world, 'structure_not_found', 'Target structure does not exist.');
  const room = structure.rooms.find((entry) => entry.id === input.roomId);
  if (!room) return reject(world, 'room_not_found', 'Target room does not exist.');
  const zone = room.zones.find((entry) => entry.id === input.zoneId);
  if (!zone) return reject(world, 'zone_not_found', 'Target zone does not exist.');
  if (room.purpose !== 'growroom') {
    return reject(world, 'invalid_placement', 'Plants may only be sown in growroom zones.');
  }

  const strain = resolveStrain(world, input.strainId);
  if (!strain) return reject(world, 'strain_not_found', 'Strain is not available in this world.');
  // A selected custom F1 is replanted from retained breeding stock in this slice.
  const price = strain.source === 'custom'
    ? { seedPrice: 0, harvestPricePerGram: 0 }
    : STRAIN_PRICES[input.strainId];
  if (!price) return reject(world, 'price_unavailable', 'Strain has no authoritative seed price.');
  const plantIds = Array.from({ length: input.count }, (_, index) =>
    deterministicUuid(world.seed, `plants:sow:${zone.id}:${input.intentId}:${String(index)}`),
  );
  // Harvested records are immutable lifecycle history, not occupied capacity.
  const activePlants = zone.plants.filter((plant) => plant.status !== 'harvested');
  const existingPosting = world.economy?.ledger.find((entry) => entry.intentId === input.intentId);
  const isReplay = activePlants.length === plantIds.length && activePlants.every(
    (plant, index) => plant.id === plantIds[index] && plant.strainId === input.strainId,
  );
  if (isReplay) {
    const description = `strain=${input.strainId};quantity=${String(input.count)};unitPriceCc=${String(price.seedPrice)}`;
    const metadataMatches = existingPosting?.metadata === undefined
      ? existingPosting?.description === description
      : existingPosting.metadata.strainId === input.strainId
        && existingPosting.metadata.quantity === input.count
        && existingPosting.metadata.unitPriceCc === price.seedPrice;
    if (!existingPosting
      || existingPosting.category !== 'seed'
      || existingPosting.referenceId !== zone.id
      || !metadataMatches) {
      return reject(world, 'intent_conflict', 'intentId has no matching seed transaction.');
    }
    const seedCost: DeferredSeedCost = {
      unitPriceCc: price.seedPrice,
      quantity: input.count,
      amountCc: existingPosting.amountCc,
      booking: 'booked',
      ledgerEntryId: existingPosting.id,
      balanceAfterCc: existingPosting.balanceAfterCc,
    };
    return { ok: true, world, plantIds, replayed: true, seedCost };
  }
  if (existingPosting) {
    return reject(world, 'intent_conflict', 'intentId was already used for another transaction.');
  }
  if (activePlants.length > 0) {
    return reject(world, 'zone_not_empty', 'Zone must be empty before sowing.');
  }

  const readiness = assessZoneSowReadiness(zone);
  if (!readiness.ready) {
    return reject(world, 'zone_not_ready', `Zone is missing: ${readiness.missingPrerequisites.join(', ')}.`);
  }
  if (input.count > readiness.maxPlants) {
    return reject(world, 'capacity_exceeded', `Plant count exceeds zone capacity of ${String(readiness.maxPlants)}.`);
  }
  if (!isCompatibleWithCultivation(strain.blueprint, zone.cultivationMethodId)) {
    return reject(world, 'incompatible_strain', 'Strain is incompatible with the zone cultivation method.');
  }

  const plants: readonly Plant[] = plantIds.map((id, index) => plantSchema.parse({
    id,
    slug: `plant-${id.slice(0, 8)}`,
    name: `${strain.blueprint.name} ${String(index + 1)}`,
    strainId: uuidSchema.parse(input.strainId),
    lifecycleStage: 'seedling',
    ageHours: 0,
    health01: 1,
    biomass_g: INITIAL_BIOMASS_G,
    containerId: zone.containerId,
    substrateId: zone.substrateId,
    readyForHarvest: false,
    status: 'active',
    moisture01: zone.moisture01,
    quality01: 1,
  }));
  const nextZone = {
    ...zone,
    plants: [...zone.plants, ...plants],
    photoperiodPhase: 'vegetative' as const,
  };
  const nextRoom = { ...room, zones: room.zones.map((entry) => entry.id === zone.id ? nextZone : entry) };
  const nextStructure = { ...structure, rooms: structure.rooms.map((entry) => entry.id === room.id ? nextRoom : entry) };
  const company = parseCompanyWorld({
    ...world.company,
    structures: world.company.structures.map((entry) => entry.id === structure.id ? nextStructure : entry),
  });
  const amountCc = price.seedPrice * input.count;
  const posting = postEconomyDebit(world, {
    intentId: input.intentId,
    category: 'seed',
    amountCc,
    referenceId: zone.id,
    identity: `intent:${input.intentId}`,
    description: `strain=${input.strainId};quantity=${String(input.count)};unitPriceCc=${String(price.seedPrice)}`,
    metadata: {
      strainId: input.strainId,
      quantity: input.count,
      unitPriceCc: price.seedPrice,
    },
  });
  if (!posting.ok) {
    const code = posting.reason === 'insufficient_funds' ? 'insufficient_funds' : 'economy_unavailable';
    const message = posting.reason === 'insufficient_funds'
      ? 'Company balance is insufficient for these seeds.'
      : 'World has no economy account.';
    return reject(world, code, message);
  }
  const seedCost: DeferredSeedCost = {
    unitPriceCc: price.seedPrice,
    quantity: input.count,
    amountCc,
    booking: 'booked',
    ledgerEntryId: posting.entry.id,
    balanceAfterCc: posting.entry.balanceAfterCc,
  };

  return { ok: true, world: { ...world, company, economy: posting.economy }, plantIds, replayed: false, seedCost };
}
