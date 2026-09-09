import { z } from 'zod';

import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import { toDeviceInstanceCapacity } from '../../domain/blueprints/deviceBlueprint.ts';
import type { SimulationWorld, ZoneDeviceInstance } from '../../domain/entities.ts';
import { parseCompanyWorld } from '../../domain/schemas/company.ts';
import { uuidSchema } from '../../domain/schemas/primitives.ts';
import { createDeviceInstance } from '../../device/createDeviceInstance.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { postEconomyDebit } from '../../economy/state.ts';
import { loadFacilityDeviceCatalog } from './facilityBlueprints.ts';
import { findRoom, findStructure, findZone, hasEntityId, rejectFacilityCommand } from './helpers.ts';
import type {
  DeferredPurchaseCost,
  DeviceCoverageResult,
  DevicePurchaseInstallResult,
} from './types.ts';

const devicePurchaseInstallSchema = z.object({
  intentId: uuidSchema,
  structureId: uuidSchema,
  roomId: uuidSchema,
  zoneId: uuidSchema,
  deviceBlueprintId: uuidSchema,
}).strict();

const QUALITY_BASE01 = 0.8 as const;
const QUALITY_VARIATION01 = 0.2 as const;
const DEFAULT_MAINTENANCE_RESTORE01 = 0.35 as const;
const DEFAULT_MAINTENANCE_THRESHOLD01 = 0.4 as const;

export interface DevicePurchaseInstallCommand {
  readonly intentId: string;
  readonly structureId: string;
  readonly roomId: string;
  readonly zoneId: string;
  readonly deviceBlueprintId: string;
}

function buildCoverage(
  zoneAreaM2: number,
  devices: readonly ZoneDeviceInstance[],
  blueprintId: string,
  installedCoverageM2: number,
): DeviceCoverageResult {
  const totalBlueprintCoverageM2 = devices
    .filter((device) => device.blueprintId === blueprintId)
    .reduce((sum, device) => sum + device.coverage_m2, 0);
  const remainingCoverageM2 = Math.max(0, zoneAreaM2 - totalBlueprintCoverageM2);

  return {
    installedCoverage_m2: installedCoverageM2,
    totalBlueprintCoverage_m2: totalBlueprintCoverageM2,
    requiredCoverage_m2: zoneAreaM2,
    remainingCoverage_m2: remainingCoverageM2,
    sufficient: remainingCoverageM2 === 0,
  };
}

/**
 * Executes `device.purchaseInstall.v1` and books its CapEx atomically.
 */
export function executeDevicePurchaseInstall(
  world: SimulationWorld,
  command: DevicePurchaseInstallCommand,
): DevicePurchaseInstallResult {
  const parsed = devicePurchaseInstallSchema.safeParse(command);
  if (!parsed.success) {
    return rejectFacilityCommand(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid device command.');
  }

  const input = parsed.data;
  const structure = findStructure(world, input.structureId);
  if (!structure) {
    return rejectFacilityCommand(world, 'structure_not_found', 'Target structure does not exist.');
  }
  const room = findRoom(structure, input.roomId);
  if (!room) {
    return rejectFacilityCommand(world, 'room_not_found', 'Target room does not exist.');
  }
  const zone = findZone(room, input.zoneId);
  if (!zone) {
    return rejectFacilityCommand(world, 'zone_not_found', 'Target zone does not exist.');
  }

  const catalogEntry = loadFacilityDeviceCatalog().get(input.deviceBlueprintId);
  if (!catalogEntry) {
    return rejectFacilityCommand(world, 'blueprint_not_found', 'Device blueprint is not part of the demo catalog.');
  }
  const { blueprint, price } = catalogEntry;
  if (blueprint.placementScope !== 'zone' || !blueprint.allowedRoomPurposes.includes(room.purpose)) {
    return rejectFacilityCommand(world, 'invalid_placement', 'Device blueprint cannot be installed at the target zone.');
  }
  if (!price) {
    return rejectFacilityCommand(world, 'price_unavailable', 'Device blueprint has no authoritative price entry.');
  }

  const entityId = deterministicUuid(world.seed, `facility:device:${input.intentId}:0`);
  const existingDevice = zone.devices.find((device) => device.id === entityId);
  const existingPosting = world.economy?.ledger.find((entry) => entry.intentId === input.intentId);
  if (existingDevice) {
    if (!existingPosting
      || existingPosting.category !== 'capital_expenditure'
      || existingPosting.referenceId !== entityId) {
      return rejectFacilityCommand(world, 'intent_conflict', 'intentId has no matching device purchase transaction.');
    }
    const purchaseCost: DeferredPurchaseCost = {
      amountCc: existingPosting.amountCc,
      booking: 'booked',
      ledgerEntryId: existingPosting.id,
      balanceAfterCc: existingPosting.balanceAfterCc,
    };
    return {
      ok: true,
      world,
      entityId,
      replayed: true,
      purchaseCost,
      coverage: buildCoverage(zone.floorArea_m2, zone.devices, blueprint.id, existingDevice.coverage_m2),
    };
  }
  if (hasEntityId(world, entityId)) {
    return rejectFacilityCommand(world, 'invalid_command', 'intentId was already used for another facility target.');
  }
  if (existingPosting) {
    return rejectFacilityCommand(world, 'intent_conflict', 'intentId was already used for another transaction.');
  }

  const seeded = createDeviceInstance(
    { sampleQuality01: (rng) => QUALITY_BASE01 + rng() * QUALITY_VARIATION01 },
    world.seed,
    entityId,
    blueprint,
  );
  const capacity = toDeviceInstanceCapacity(blueprint);
  const maintenance = blueprint.maintenance as {
    readonly intervalDays?: unknown;
    readonly hoursPerService?: unknown;
  } | undefined;
  if (capacity.coverage_m2 <= 0 || !Number.isFinite(capacity.coverage_m2)) {
    return rejectFacilityCommand(world, 'incompatible_configuration', 'Device must expose positive finite coverage.');
  }
  const device: ZoneDeviceInstance = {
    id: entityId,
    slug: blueprint.slug,
    name: blueprint.name,
    blueprintId: uuidSchema.parse(blueprint.id),
    placementScope: 'zone',
    quality01: seeded.quality01,
    condition01: 1,
    powerDraw_W: capacity.powerDraw_W,
    dutyCycle01: 1,
    efficiency01: capacity.efficiency01,
    coverage_m2: capacity.coverage_m2,
    airflow_m3_per_h: capacity.airflow_m3_per_h,
    sensibleHeatRemovalCapacity_W: Math.max(blueprint.thermal?.max_cool_W ?? 0, blueprint.thermal?.max_heat_W ?? 0),
    effects: seeded.effects,
    effectConfigs: seeded.effectConfigs,
    maintenance: {
      runtimeHours: 0,
      hoursSinceService: 0,
      totalMaintenanceCostCc: 0,
      completedServiceCount: 0,
      recommendedReplacement: false,
      policy: {
        lifetimeHours: typeof blueprint.lifetime_h === 'number' ? blueprint.lifetime_h : HOURS_PER_DAY,
        maintenanceIntervalHours: typeof maintenance?.intervalDays === 'number'
          ? maintenance.intervalDays * HOURS_PER_DAY
          : 0,
        serviceHours: typeof maintenance?.hoursPerService === 'number'
          ? maintenance.hoursPerService
          : 0,
        restoreAmount01: DEFAULT_MAINTENANCE_RESTORE01,
        baseCostPerHourCc: price.baseMaintenanceCostPerHour,
        costIncreasePer1000HoursCc: price.costIncreasePer1000Hours,
        serviceVisitCostCc: price.maintenanceServiceCost,
        replacementCostCc: price.capitalExpenditure,
        maintenanceConditionThreshold01: DEFAULT_MAINTENANCE_THRESHOLD01,
      },
    },
  };
  const nextDevices = [...zone.devices, device];
  const nextZone = { ...zone, devices: nextDevices };
  const nextRoom = { ...room, zones: room.zones.map((entry) => entry.id === zone.id ? nextZone : entry) };
  const nextStructure = { ...structure, rooms: structure.rooms.map((entry) => entry.id === room.id ? nextRoom : entry) };
  const company = parseCompanyWorld({
    ...world.company,
    structures: world.company.structures.map((entry) => entry.id === structure.id ? nextStructure : entry),
  });
  const posting = postEconomyDebit(world, {
    intentId: input.intentId,
    category: 'capital_expenditure',
    amountCc: price.capitalExpenditure,
    referenceId: entityId,
    identity: `intent:${input.intentId}`,
    description: `Purchase and install ${blueprint.name}`,
  });
  if (!posting.ok) {
    const code = posting.reason === 'insufficient_funds' ? 'insufficient_funds' : 'economy_unavailable';
    const message = posting.reason === 'insufficient_funds'
      ? 'Company balance is insufficient for this device purchase.'
      : 'World has no economy account.';
    return rejectFacilityCommand(world, code, message);
  }
  const purchaseCost: DeferredPurchaseCost = {
    amountCc: posting.entry.amountCc,
    booking: 'booked',
    ledgerEntryId: posting.entry.id,
    balanceAfterCc: posting.entry.balanceAfterCc,
  };

  return {
    ok: true,
    world: { ...world, company, economy: posting.economy },
    entityId,
    replayed: false,
    purchaseCost,
    coverage: buildCoverage(zone.floorArea_m2, nextDevices, blueprint.id, capacity.coverage_m2),
  };
}
