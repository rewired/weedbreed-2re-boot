import {
  AREA_QUANTUM_M2,
  FLOAT_TOLERANCE,
  LATITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LONGITUDE_MAX_DEG,
  LONGITUDE_MIN_DEG
} from '@/backend/src/constants/simConstants';

import { type Company } from '../entities.ts';
import { validateDevice, type WorldValidationIssue } from './devices.ts';
import { isValidArea, validateRoom } from './roomsZones.ts';

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
 * Validates a company world tree against canonical SEC guardrails.
 *
 * @param company - Company world tree to validate.
 * @returns Result describing whether the world is valid and the list of issues.
 */
export function validateCompanyWorld(
  company: Company
): WorldValidationResult {
  const issues: WorldValidationIssue[] = [];

  const location = (company as Partial<Company>).location;

  if (!location) {
    issues.push({
      path: 'company.location',
      message: 'company must define a location'
    });
  } else {
    const { lon, lat, cityName, countryName } = location;

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

  const rawStructures = (company as Partial<Company>).structures;

  if (!Array.isArray(rawStructures)) {
    issues.push({
      path: 'company.structures',
      message: 'company.structures must be an array'
    });

    return {
      ok: false,
      issues
    } satisfies WorldValidationResult;
  }

  const structures = rawStructures as Company['structures'];

  structures.forEach((structure, structureIndex) => {
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
