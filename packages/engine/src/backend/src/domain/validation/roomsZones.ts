import {
  AREA_QUANTUM_M2,
  FLOAT_TOLERANCE,
  HOURS_PER_DAY,
  LIGHT_SCHEDULE_GRID_HOURS
} from '@/backend/src/constants/simConstants';

import {
  type LightSchedule,
  type PhotoperiodPhase,
  type Room,
  PLANT_LIFECYCLE_STAGES,
  ROOM_PURPOSES
} from '../entities.ts';
import {
  HarvestLotSchema,
  isHarvestLot
} from '../schemas/HarvestLotSchema.ts';
import { InventorySchema } from '../schemas/InventorySchema.ts';
import {
  isWithinUnitInterval,
  validateDevice,
  type WorldValidationIssue
} from './devices.ts';

const VALID_ROOM_PURPOSES = new Set(ROOM_PURPOSES);
const VALID_PHOTOPERIOD_PHASES = new Set<PhotoperiodPhase>([
  'vegetative',
  'flowering'
]);

/**
 * Determines whether an area aligns with the canonical area quantum.
 *
 * @param area - Area value expressed in square metres.
 * @returns True when the area is a non-negative multiple of {@link AREA_QUANTUM_M2}.
 */
export function isValidArea(area: number): boolean {
  if (area < 0) {
    return false;
  }
  const units = area / AREA_QUANTUM_M2;
  return Math.abs(units - Math.round(units)) <= FLOAT_TOLERANCE;
}

/**
 * Validates that a light schedule adheres to SEC §8 constraints.
 *
 * @param schedule - Light schedule to evaluate.
 * @returns Optional validation issue when a constraint is violated.
 */
function validateLightSchedule(
  schedule: LightSchedule
): WorldValidationIssue | undefined {
  const path = 'lightSchedule';

  if (!Number.isFinite(schedule.onHours)) {
    return {
      path,
      message: 'onHours must be a finite number'
    } satisfies WorldValidationIssue;
  }

  if (!Number.isFinite(schedule.offHours)) {
    return {
      path,
      message: 'offHours must be a finite number'
    } satisfies WorldValidationIssue;
  }

  if (!Number.isFinite(schedule.startHour)) {
    return {
      path,
      message: 'startHour must be a finite number'
    } satisfies WorldValidationIssue;
  }

  if (schedule.onHours < 0 || schedule.onHours > HOURS_PER_DAY) {
    return {
      path,
      message: `onHours must lie within [0,${String(HOURS_PER_DAY)}]`
    } satisfies WorldValidationIssue;
  }

  if (schedule.offHours < 0 || schedule.offHours > HOURS_PER_DAY) {
    return {
      path,
      message: `offHours must lie within [0,${String(HOURS_PER_DAY)}]`
    } satisfies WorldValidationIssue;
  }

  const sum = schedule.onHours + schedule.offHours;
  if (Math.abs(sum - HOURS_PER_DAY) > FLOAT_TOLERANCE) {
    return {
      path,
      message: `onHours + offHours must equal ${String(HOURS_PER_DAY)} hours`
    } satisfies WorldValidationIssue;
  }

  if (schedule.startHour < 0 || schedule.startHour >= HOURS_PER_DAY) {
    return {
      path,
      message: `startHour must lie within [0,${String(HOURS_PER_DAY)})`
    } satisfies WorldValidationIssue;
  }

  const onMod = Math.abs(
    schedule.onHours / LIGHT_SCHEDULE_GRID_HOURS -
      Math.round(schedule.onHours / LIGHT_SCHEDULE_GRID_HOURS)
  );
  const offMod = Math.abs(
    schedule.offHours / LIGHT_SCHEDULE_GRID_HOURS -
      Math.round(schedule.offHours / LIGHT_SCHEDULE_GRID_HOURS)
  );

  if (onMod > FLOAT_TOLERANCE || offMod > FLOAT_TOLERANCE) {
    return {
      path,
      message: 'onHours and offHours must align to the 15 minute grid'
    } satisfies WorldValidationIssue;
  }

  return undefined;
}

/**
 * Validates a room subtree, including nested zones, plants, and devices.
 *
 * @param room - Room node being evaluated.
 * @param path - Path prefix pointing to the room node.
 * @param issues - Mutable collection receiving discovered validation issues.
 */
export function validateRoom(
  room: Room,
  path: string,
  issues: WorldValidationIssue[]
): void {
  if (!VALID_ROOM_PURPOSES.has(room.purpose)) {
    issues.push({
      path: `${path}.purpose`,
      message: `room purpose must be one of: ${ROOM_PURPOSES.join(', ')}`
    });
    return;
  }

  if (!isValidArea(room.floorArea_m2)) {
    issues.push({
      path: `${path}.floorArea_m2`,
      message: `room floor area must be a multiple of ${String(AREA_QUANTUM_M2)}`
    });
  }

  if (room.height_m <= 0) {
    issues.push({
      path: `${path}.height_m`,
      message: 'room height must be positive'
    });
  }

  room.devices.forEach((device, deviceIndex) => {
    validateDevice(
      device,
      'room',
      `${path}.devices[${String(deviceIndex)}]`,
      issues
    );
  });

  if (room.purpose !== 'growroom' && room.zones.length > 0) {
    issues.push({
      path: `${path}.zones`,
      message: 'only growrooms may contain zones'
    });
  }

  const totalZoneArea = room.zones.reduce(
    (sum, zone) => sum + zone.floorArea_m2,
    0
  );

  if (totalZoneArea - room.floorArea_m2 > FLOAT_TOLERANCE) {
    issues.push({
      path: `${path}.zones`,
      message: 'total zone area exceeds room capacity'
    });
  }

  room.zones.forEach((zone, zoneIndex) => {
    const zonePath = `${path}.zones[${String(zoneIndex)}]`;

    if (!isValidArea(zone.floorArea_m2)) {
      issues.push({
        path: `${zonePath}.floorArea_m2`,
        message: `zone floor area must be a multiple of ${String(AREA_QUANTUM_M2)}`
      });
    }

    if (zone.height_m <= 0) {
      issues.push({
        path: `${zonePath}.height_m`,
        message: 'zone height must be positive'
      });
    }

    if (!zone.cultivationMethodId) {
      issues.push({
        path: `${zonePath}.cultivationMethodId`,
        message: 'zones must declare a cultivation method id'
      });
    }

    if (!zone.irrigationMethodId) {
      issues.push({
        path: `${zonePath}.irrigationMethodId`,
        message: 'zones must declare an irrigation method id'
      });
    }

    if (!zone.containerId) {
      issues.push({
        path: `${zonePath}.containerId`,
        message: 'zones must declare a container id'
      });
    }

    if (!zone.substrateId) {
      issues.push({
        path: `${zonePath}.substrateId`,
        message: 'zones must declare a substrate id'
      });
    }

    const scheduleIssue = validateLightSchedule(zone.lightSchedule);
    if (scheduleIssue) {
      issues.push({
        path: `${zonePath}.${scheduleIssue.path}`,
        message: scheduleIssue.message
      });
    }

    if (!VALID_PHOTOPERIOD_PHASES.has(zone.photoperiodPhase)) {
      issues.push({
        path: `${zonePath}.photoperiodPhase`,
        message: 'photoperiod phase must be either "vegetative" or "flowering"'
      });
    }

    if (!Number.isFinite(zone.environment.airTemperatureC)) {
      issues.push({
        path: `${zonePath}.environment.airTemperatureC`,
        message: 'zone air temperature must be a finite number'
      });
    }

    if (!Number.isFinite(zone.ppfd_umol_m2s)) {
      issues.push({
        path: `${zonePath}.ppfd_umol_m2s`,
        message: 'zone PPFD must be a finite number'
      });
    } else if (zone.ppfd_umol_m2s < 0) {
      issues.push({
        path: `${zonePath}.ppfd_umol_m2s`,
        message: 'zone PPFD must be non-negative'
      });
    }

    if (!Number.isFinite(zone.dli_mol_m2d_inc)) {
      issues.push({
        path: `${zonePath}.dli_mol_m2d_inc`,
        message: 'zone DLI increment must be a finite number'
      });
    } else if (zone.dli_mol_m2d_inc < 0) {
      issues.push({
        path: `${zonePath}.dli_mol_m2d_inc`,
        message: 'zone DLI increment must be non-negative'
      });
    }

    zone.devices.forEach((device, deviceIndex) => {
      validateDevice(
        device,
        'zone',
        `${zonePath}.devices[${String(deviceIndex)}]`,
        issues
      );
    });

    zone.plants.forEach((plant, plantIndex) => {
      const plantPath = `${zonePath}.plants[${String(plantIndex)}]`;

      if (!PLANT_LIFECYCLE_STAGES.includes(plant.lifecycleStage)) {
        issues.push({
          path: `${plantPath}.lifecycleStage`,
          message: 'plant lifecycle stage is invalid'
        });
      }

      if (plant.ageHours < 0) {
        issues.push({
          path: `${plantPath}.ageHours`,
          message: 'plant age must be non-negative'
        });
      }

      if (!isWithinUnitInterval(plant.health01)) {
        issues.push({
          path: `${plantPath}.health01`,
          message: 'plant health01 must lie within [0,1]'
        });
      }

      if (plant.biomass_g < 0) {
        issues.push({
          path: `${plantPath}.biomass_g`,
          message: 'plant biomass must be non-negative'
        });
      }

      if (!plant.containerId) {
        issues.push({
          path: `${plantPath}.containerId`,
          message: 'plants must reference a container id'
        });
      }

      if (!plant.substrateId) {
        issues.push({
          path: `${plantPath}.substrateId`,
          message: 'plants must reference a substrate id'
        });
      }

      if (plant.readyForHarvest !== undefined && typeof plant.readyForHarvest !== 'boolean') {
        issues.push({
          path: `${plantPath}.readyForHarvest`,
          message: 'readyForHarvest must be a boolean when provided'
        });
      }

      if (plant.harvestedAt_tick !== undefined) {
        if (!Number.isFinite(plant.harvestedAt_tick)) {
          issues.push({
            path: `${plantPath}.harvestedAt_tick`,
            message: 'harvestedAt_tick must be a finite number'
          });
        } else if (plant.harvestedAt_tick < 0) {
          issues.push({
            path: `${plantPath}.harvestedAt_tick`,
            message: 'harvestedAt_tick must be non-negative'
          });
        }
      }

      const status: unknown = plant.status;

      if (status !== undefined) {
        if (typeof status !== 'string' || (status !== 'active' && status !== 'harvested')) {
          issues.push({
            path: `${plantPath}.status`,
            message: 'plant status must be either "active" or "harvested"'
          });
        }
      }

      if (typeof plant.moisture01 === 'number' && !isWithinUnitInterval(plant.moisture01)) {
        issues.push({
          path: `${plantPath}.moisture01`,
          message: 'plant moisture01 must lie within [0,1]'
        });
      }

      if (typeof plant.quality01 === 'number' && !isWithinUnitInterval(plant.quality01)) {
        issues.push({
          path: `${plantPath}.quality01`,
          message: 'plant quality01 must lie within [0,1]'
        });
      }
    });
  });
  const tags = room.tags ?? [];
  const isStorageClass = room.class === 'room.storage';
  const hasStorageTag = tags.includes('storage');
  const isStoragePurpose = room.purpose === 'storageroom';
  const isStorageRoom = isStorageClass || hasStorageTag || isStoragePurpose;

  const inventoryParseResult =
    room.inventory !== undefined
      ? InventorySchema.safeParse(room.inventory)
      : undefined;

  if (room.inventory) {
    if (!Array.isArray(room.inventory.lots)) {
      issues.push({
        path: `${path}.inventory.lots`,
        message: 'inventory.lots must be an array'
      });
    } else {
      room.inventory.lots.forEach((lot, lotIndex) => {
        const lotPath = `${path}.inventory.lots[${String(lotIndex)}]`;

        if (!isHarvestLot(lot)) {
          issues.push({
            path: lotPath,
            message: 'inventory lot is not a valid HarvestLot'
          });
          return;
        }

        const lotParseResult = HarvestLotSchema.safeParse(lot);
        if (!lotParseResult.success) {
          issues.push({
            path: lotPath,
            message: 'inventory lot is not a valid HarvestLot'
          });
          return;
        }

        const harvestLot = lotParseResult.data;

        if (harvestLot.freshWeight_kg < 0) {
          issues.push({
            path: `${lotPath}.freshWeight_kg`,
            message: 'harvest lot fresh weight must be non-negative'
          });
        }

        if (!isWithinUnitInterval(harvestLot.moisture01)) {
          issues.push({
            path: `${lotPath}.moisture01`,
            message: 'harvest lot moisture01 must lie within [0,1]'
          });
        }

        if (!isWithinUnitInterval(harvestLot.quality01)) {
          issues.push({
            path: `${lotPath}.quality01`,
            message: 'harvest lot quality01 must lie within [0,1]'
          });
        }

        if (!Number.isInteger(lot.createdAt_tick) || lot.createdAt_tick < 0) {
          issues.push({
            path: `${lotPath}.createdAt_tick`,
            message: 'harvest lot createdAt_tick must be a non-negative integer'
          });
        }
      });
    }

    if (!inventoryParseResult?.success) {
      issues.push({
        path: `${path}.inventory`,
        message: 'inventory is not a valid Inventory'
      });
    }
  }

  const inventoryLots = room.inventory?.lots;
  const inventoryLotsArray: readonly unknown[] = Array.isArray(inventoryLots)
    ? inventoryLots
    : [];

  if (!isStorageRoom && inventoryLotsArray.length > 0) {
    issues.push({
      path: `${path}.inventory`,
      message: 'only storage rooms may contain harvest inventory'
    });
  }

  if (isStorageRoom && room.inventory === undefined) {
    issues.push({
      path: `${path}.inventory`,
      message: 'storage rooms must initialise an inventory'
    });
  }
}
