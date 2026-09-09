/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { DemoEnvironmentalIncidentState, SimulationWorld } from '@wb/engine';
import type { SimulationIncidentSummary } from '../readModels/types.js';

function findIncidentZone(world: SimulationWorld, zoneId: string) {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      const zone = room.zones.find((candidate) => candidate.id === zoneId);
      if (zone) {
        return { structure, zone };
      }
    }
  }

  return null;
}

function averagePlantHealth(healthValues: readonly number[]): number | null {
  if (healthValues.length === 0) {
    return null;
  }

  return healthValues.reduce((sum, health) => sum + health, 0) / healthValues.length;
}

/** Projects the persisted demo incident and its current, measurable plant consequence. */
export function mapSimulationIncidents(world: SimulationWorld): SimulationIncidentSummary[] {
  const incident: DemoEnvironmentalIncidentState | undefined = world.demoIncident;
  if (!incident) {
    return [];
  }

  const location = findIncidentZone(world, incident.zoneId);
  if (!location) {
    return [];
  }

  const healthValues = location.zone.plants.map((plant) => plant.health01);
  const [minimumTemperature, maximumTemperature] = incident.targetBandC;

  return [{
    id: `${incident.code}:${incident.zoneId}:${String(incident.triggeredAtSimTimeHours)}`,
    code: incident.code,
    message: incident.status === 'active'
      ? 'Zone temperature is above the target band.'
      : 'Zone temperature returned to the target band.',
    severity: incident.status === 'active' ? 'critical' : 'info',
    raisedAtTick: Math.floor(incident.triggeredAtSimTimeHours),
    status: incident.status,
    zoneId: incident.zoneId,
    measured: {
      metric: 'temperature_C',
      value: incident.measuredTemperatureC,
    },
    targetBand: {
      min: minimumTemperature,
      max: maximumTemperature,
    },
    consequence: {
      code: incident.consequence,
      affectedPlantCount: healthValues.length,
      averagePlantHealth01: averagePlantHealth(healthValues),
    },
    recommendedIntent: {
      type: incident.recommendedIntent,
      payload: {
        structureId: location.structure.id,
        zoneId: incident.zoneId,
        target: {
          temperature_C: (minimumTemperature + maximumTemperature) / 2,
        },
      },
    },
    resolvedAtTick: incident.resolvedAtSimTimeHours === undefined
      ? null
      : Math.floor(incident.resolvedAtSimTimeHours),
  } satisfies SimulationIncidentSummary];
}
