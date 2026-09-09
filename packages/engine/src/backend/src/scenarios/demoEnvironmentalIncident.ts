import { HOURS_PER_TICK } from '../constants/simConstants.ts';
import { resolveStrain } from '../domain/blueprints/strainResolver.ts';
import type {
  DemoEnvironmentalIncidentState,
  SimulationWorld,
  Zone,
} from '../domain/entities.ts';
import { createRng } from '../util/rng.ts';

/** Simulation hour at whose environment phase the demo incident activates. */
export const DEMO_ENVIRONMENT_INCIDENT_TRIGGER_HOUR = 2 as const;
/** Temperature imposed by the deterministic demo incident. */
export const DEMO_ENVIRONMENT_INCIDENT_TEMPERATURE_C = 32 as const;

interface EligibleZone {
  readonly zone: Zone;
  readonly targetBandC: readonly [number, number];
}

function collectEligibleZones(world: SimulationWorld): readonly EligibleZone[] {
  const candidates: EligibleZone[] = [];

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const firstPlant = zone.plants[0];

        if (!firstPlant) {
          continue;
        }

        const strain = resolveStrain(world, firstPlant.strainId)?.blueprint;
        const temperatureBand = strain?.envBands.veg?.temp_C ?? strain?.envBands.default.temp_C;

        if (temperatureBand) {
          candidates.push({ zone, targetBandC: temperatureBand.green });
        }
      }
    }
  }

  return candidates.sort((left, right) => left.zone.id.localeCompare(right.zone.id));
}

function replaceZone(world: SimulationWorld, replacement: Zone): SimulationWorld {
  const structures = world.company.structures.map((structure) => {
    const rooms = structure.rooms.map((room) => {
      const zones = room.zones.map((zone) => zone.id === replacement.id ? replacement : zone);
      return zones.some((zone, index) => zone !== room.zones[index]) ? { ...room, zones } : room;
    });
    return rooms.some((room, index) => room !== structure.rooms[index])
      ? { ...structure, rooms }
      : structure;
  });

  return {
    ...world,
    company: { ...world.company, structures },
  } satisfies SimulationWorld;
}

function findIncidentZone(world: SimulationWorld, zoneId: Zone['id']): Zone | undefined {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      const zone = room.zones.find((candidate) => candidate.id === zoneId);
      if (zone) return zone;
    }
  }
  return undefined;
}

function isWithinBand(value: number, band: readonly [number, number]): boolean {
  return value >= band[0] && value <= band[1];
}

/**
 * Applies or resolves the explicit `game.new.v1` temperature incident.
 * The function is pure; all replay state is stored in the returned world tree.
 */
export function applyDemoEnvironmentalIncident(world: SimulationWorld): SimulationWorld {
  if (world.scenarioId !== 'game.new.v1') {
    return world;
  }

  const existing = world.demoIncident;
  if (existing?.status === 'resolved') {
    return world;
  }

  if (existing?.status === 'active') {
    const zone = findIncidentZone(world, existing.zoneId);
    if (!zone) return world;

    const measuredTemperatureC = zone.environment.airTemperatureC;
    const resolved = isWithinBand(measuredTemperatureC, existing.targetBandC);
    if (!resolved && measuredTemperatureC === existing.measuredTemperatureC) return world;

    const demoIncident: DemoEnvironmentalIncidentState = {
      ...existing,
      status: resolved ? 'resolved' : 'active',
      measuredTemperatureC,
      ...(resolved
        ? { resolvedAtSimTimeHours: world.simTimeHours + HOURS_PER_TICK }
        : {}),
    };
    return { ...world, demoIncident } satisfies SimulationWorld;
  }

  if (world.simTimeHours !== DEMO_ENVIRONMENT_INCIDENT_TRIGGER_HOUR) {
    return world;
  }

  const candidates = collectEligibleZones(world);
  if (candidates.length === 0) {
    return world;
  }

  const rng = createRng(
    world.seed,
    `demo-environment-incident:${String(world.simTimeHours)}:${candidates.map(({ zone }) => zone.id).join(':')}`,
  );
  const selected = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
  if (!selected) return world;

  const incidentZone: Zone = {
    ...selected.zone,
    environment: {
      ...selected.zone.environment,
      airTemperatureC: DEMO_ENVIRONMENT_INCIDENT_TEMPERATURE_C,
    },
  };
  const demoIncident: DemoEnvironmentalIncidentState = {
    code: 'demo.environment.temperature_high',
    zoneId: selected.zone.id,
    status: 'active',
    triggeredAtSimTimeHours: world.simTimeHours + HOURS_PER_TICK,
    measuredTemperatureC: DEMO_ENVIRONMENT_INCIDENT_TEMPERATURE_C,
    targetBandC: selected.targetBandC,
    consequence: 'plant_heat_stress',
    recommendedIntent: 'intent.zone.climate.adjust.v1',
  };

  return {
    ...replaceZone(world, incidentZone),
    demoIncident,
  } satisfies SimulationWorld;
}
