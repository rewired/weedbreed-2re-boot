import type { Zone } from '../../domain/entities.ts';
import { loadDemoScenarioBlueprints } from '../../scenarios/demoScenarioBlueprints.ts';
import {
  DEMO_CLIMATE_BLUEPRINT_ID,
  DEMO_LIGHTING_BLUEPRINT_ID,
} from '../facility/facilityBlueprints.ts';

/** Readiness and cultivation capacity needed by the authoritative sow command. */
export interface ZoneSowReadiness {
  readonly ready: boolean;
  readonly maxPlants: number;
  readonly missingPrerequisites: readonly string[];
}

function coverageFor(zone: Zone, blueprintId: string): number {
  return zone.devices
    .filter((device) => device.blueprintId === blueprintId)
    .reduce((sum, device) => sum + device.coverage_m2, 0);
}

/** Evaluates the exact demo prerequisites and the strictest declared planting density. */
export function assessZoneSowReadiness(zone: Zone): ZoneSowReadiness {
  const blueprints = loadDemoScenarioBlueprints();
  const missing: string[] = [];
  const configurationValid =
    zone.cultivationMethodId === blueprints.cultivationMethod.id &&
    zone.containerId === blueprints.container.id &&
    zone.substrateId === blueprints.substrate.id &&
    zone.irrigationMethodId === blueprints.irrigation.id;
  if (!configurationValid) {
    missing.push('valid-cultivation-configuration');
  }
  if (coverageFor(zone, DEMO_LIGHTING_BLUEPRINT_ID) < zone.floorArea_m2) {
    missing.push('lighting-coverage');
  }
  if (coverageFor(zone, DEMO_CLIMATE_BLUEPRINT_ID) < zone.floorArea_m2) {
    missing.push('climate-control');
  }

  const capacityCandidates: number[] = [];
  const areaPerPlantM2 = blueprints.cultivationMethod.areaPerPlant_m2;
  if (areaPerPlantM2 !== undefined) {
    capacityCandidates.push(Math.floor(zone.floorArea_m2 / areaPerPlantM2));
  }
  const plantsPerM2 = blueprints.cultivationMethod.capacityHints?.plantsPer_m2;
  if (plantsPerM2 !== undefined) {
    capacityCandidates.push(Math.floor(zone.floorArea_m2 * plantsPerM2));
  }
  const maxPlants = capacityCandidates.length > 0 ? Math.min(...capacityCandidates) : 0;
  if (maxPlants <= 0) {
    missing.push('plant-capacity');
  }

  return { ready: missing.length === 0, maxPlants, missingPrerequisites: missing };
}
