import {
  AREA_QUANTUM_M2,
  FLOAT_TOLERANCE,
  HOURS_PER_DAY,
  LATITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LIGHT_SCHEDULE_GRID_HOURS,
  LONGITUDE_MAX_DEG,
  LONGITUDE_MIN_DEG
} from '@/backend/src/constants/simConstants.js';

import {
  type Company,
  type DeviceInstance,
  type DevicePlacementScope,
  type LightSchedule,
  type PhotoperiodPhase,
  type Room,
  PLANT_LIFECYCLE_STAGES,
  ROOM_PURPOSES
} from './entities.js';

const VALID_ROOM_PURPOSES = new Set(ROOM_PURPOSES);
const VALID_PHOTOPERIOD_PHASES = new Set<PhotoperiodPhase>([
  'vegetative',
  'flowering'
]);

/**
 * Validation issue emitted when the world tree violates SEC guardrails.
 */
export interface WorldValidationIssue {
  /** JSON pointer-esque path locating the problematic node. */
  readonly path: string;
  /** Human-readable explanation of the violation. */
  readonly message: string;
}

/**
 * Result of validating a company world tree.
 */
export interface WorldValidationResult {
  /** Whether the world tree satisfies all invariants. */
  readonly ok: boolean;
  /** Collection of issues describing each violation. */
  readonly issues: readonly WorldValidationIssue[];
}

/**
 * Determines whether the provided value lies within the canonical unit interval.
 *
 * @param value - Value to evaluate.
 * @returns True when {@link value} ∈ [0,1].
 */
function isWithinUnitInterval(value: number): boolean {
  return value >= 0 - FLOAT_TOLERANCE && value <= 1 + FLOAT_TOLERANCE;
}

/**
 * Determines whether an area aligns with the canonical area quantum.
 *
 * @param area - Area value expressed in square metres.
 * @returns True when the area is a non-negative multiple of {@link AREA_QUANTUM_M2}.
 */
function isValidArea(area: number): boolean {
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
 * Validates a device instance against canonical invariants and placement scope.
 *
 * @param device - Device instance to evaluate.
 * @param expectedScope - Placement scope enforced by the containing node.
 * @param path - Path to the device within the world tree.
 * @param issues - Mutable issue collection.
 */
function validateDevice(
  device: DeviceInstance,
  expectedScope: DevicePlacementScope,
  path: string,
  issues: WorldValidationIssue[]
): void {
  if (device.placementScope !== expectedScope) {
    issues.push({
      path: `${path}.placementScope`,
      message: `device placement scope must be "${expectedScope}"`
    });
  }

  if (!isWithinUnitInterval(device.quality01)) {
    issues.push({
      path: `${path}.quality01`,
      message: 'device quality01 must lie within [0,1]'
    });
  }

  if (!isWithinUnitInterval(device.condition01)) {
    issues.push({
      path: `${path}.condition01`,
      message: 'device condition01 must lie within [0,1]'
    });
  }

  if (device.powerDraw_W < 0) {
    issues.push({
      path: `${path}.powerDraw_W`,
      message: 'device power draw must be non-negative'
    });
  }

  if (!isWithinUnitInterval(device.dutyCycle01)) {
    issues.push({
      path: `${path}.dutyCycle01`,
      message: 'device dutyCycle01 must lie within [0,1]'
    });
  }

  if (!isWithinUnitInterval(device.efficiency01)) {
    issues.push({
      path: `${path}.efficiency01`,
      message: 'device efficiency01 must lie within [0,1]'
    });
  }

  if (device.sensibleHeatRemovalCapacity_W < 0) {
    issues.push({
      path: `${path}.sensibleHeatRemovalCapacity_W`,
      message: 'device sensible heat removal capacity must be non-negative'
    });
  }

  if (device.coverage_m2 < 0) {
    issues.push({
      path: `${path}.coverage_m2`,
      message: 'device coverage_m2 must be non-negative'
    });
  }

  if (device.airflow_m3_per_h < 0) {
    issues.push({
      path: `${path}.airflow_m3_per_h`,
      message: 'device airflow_m3_per_h must be non-negative'
    });
  }
}

/**
 * Validates a room subtree, including nested zones, plants, and devices.
 *
 * @param room - Room node being evaluated.
 * @param path - Path prefix pointing to the room node.
 * @param issues - Mutable collection receiving discovered validation issues.
 */
function validateRoom(
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
    });
  });
}

/**
 * Validates a company world tree against canonical SEC guardrails.
 *
 * @param company - Company world tree to validate.
 * @returns Result describing whether the world is valid and the list of issues.
 */
export function validateCompanyWorld(
  company: Company
): WorldValidationResult {
  const issues: WorldValidationIssue[] = [];

  if (!company.location) {
    issues.push({
      path: 'company.location',
      message: 'company must define a location'
    });
  } else {
    const { lon, lat, cityName, countryName } = company.location;

    if (!Number.isFinite(lon)) {
      issues.push({
        path: 'company.location.lon',
        message: 'longitude must be a finite number'
      });
    } else if (lon < LONGITUDE_MIN_DEG || lon > LONGITUDE_MAX_DEG) {
      issues.push({
        path: 'company.location.lon',
        message: `longitude must lie within [${String(LONGITUDE_MIN_DEG)}, ${String(LONGITUDE_MAX_DEG)}]`
      });
    }

    if (!Number.isFinite(lat)) {
      issues.push({
        path: 'company.location.lat',
        message: 'latitude must be a finite number'
      });
    } else if (lat < LATITUDE_MIN_DEG || lat > LATITUDE_MAX_DEG) {
      issues.push({
        path: 'company.location.lat',
        message: `latitude must lie within [${String(LATITUDE_MIN_DEG)}, ${String(LATITUDE_MAX_DEG)}]`
      });
    }

    if (typeof cityName !== 'string' || cityName.trim().length === 0) {
      issues.push({
        path: 'company.location.cityName',
        message: 'city name must not be empty'
      });
    }

    if (typeof countryName !== 'string' || countryName.trim().length === 0) {
      issues.push({
        path: 'company.location.countryName',
        message: 'country name must not be empty'
      });
    }
  }

  company.structures.forEach((structure, structureIndex) => {
    const structurePath = `company.structures[${String(structureIndex)}]`;

    if (!isValidArea(structure.floorArea_m2)) {
      issues.push({
        path: `${structurePath}.floorArea_m2`,
        message: `structure floor area must be a multiple of ${String(AREA_QUANTUM_M2)}`
      });
    }

    if (structure.height_m <= 0) {
      issues.push({
        path: `${structurePath}.height_m`,
        message: 'structure height must be positive'
      });
    }

    structure.devices.forEach((device, deviceIndex) => {
      validateDevice(
        device,
        'structure',
        `${structurePath}.devices[${String(deviceIndex)}]`,
        issues
      );
    });

    const totalRoomArea = structure.rooms.reduce(
      (sum, room) => sum + room.floorArea_m2,
      0
    );

    if (totalRoomArea - structure.floorArea_m2 > FLOAT_TOLERANCE) {
      issues.push({
        path: `${structurePath}.rooms`,
        message: 'total room area exceeds structure capacity'
      });
    }

    structure.rooms.forEach((room, roomIndex) => {
      validateRoom(
        room,
        `${structurePath}.rooms[${String(roomIndex)}]`,
        issues
      );
    });
  });

  return {
    ok: issues.length === 0,
    issues
  } satisfies WorldValidationResult;
}
