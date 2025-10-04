import { FLOAT_TOLERANCE, HOURS_PER_TICK } from '../../constants/simConstants.js';
import type {
  Plant,
  PlantLifecycleStage,
  SimulationWorld,
  Uuid,
  Zone
} from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import type { StrainBlueprint } from '../../domain/blueprints/strainBlueprint.js';
import { createRng } from '../../util/rng.js';
import {
  calculateBiomassIncrement,
  calculateHealthDecay,
  calculateHealthRecovery
} from '../../util/growth.js';
import {
  calculateCombinedStress
} from '../../util/stress.js';
import {
  shouldTransitionToFlowering,
  shouldTransitionToHarvestReady,
  shouldTransitionToVegetative
} from '../../util/photoperiod.js';

interface PhysiologyRuntime {
  readonly strainBlueprints: Map<Uuid, StrainBlueprint>;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function resolveTickHours(ctx: EngineRunContext): number {
  const candidate =
    (ctx as { tickDurationHours?: unknown }).tickDurationHours ??
    (ctx as { tickHours?: unknown }).tickHours;

  if (isPositiveFinite(candidate)) {
    return candidate;
  }

  return HOURS_PER_TICK;
}

function getOrLoadStrainBlueprint(
  strainId: Uuid,
  runtime: PhysiologyRuntime
): StrainBlueprint | null {
  const cached = runtime.strainBlueprints.get(strainId);

  if (cached) {
    return cached;
  }

  // TODO: Load strain blueprint definitions from the filesystem (separate task).
  return null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function hasNumericChange(previous: number, next: number): boolean {
  return Math.abs(previous - next) > FLOAT_TOLERANCE;
}

function updatePlantPhysiology(
  plant: Plant,
  zone: Zone,
  strain: StrainBlueprint,
  tickHours: number,
  worldSeed: string
): Plant {
  const rng = createRng(worldSeed, `plant:${plant.id}`);
  const nextAge = plant.ageHours + tickHours;
  const stress01 = calculateCombinedStress(zone.environment, zone.ppfd_umol_m2s, strain, plant.lifecycleStage);
  const biomassIncrement = calculateBiomassIncrement(
    zone.dli_mol_m2d_inc,
    zone.environment.airTemperatureC,
    stress01,
    strain,
    plant.lifecycleStage,
    plant.biomass_g,
    tickHours,
    rng
  );
  const nextBiomass = plant.biomass_g + biomassIncrement;
  const healthDecay = calculateHealthDecay(stress01, plant.health01, tickHours, rng);
  const healthRecovery = calculateHealthRecovery(stress01, plant.health01, tickHours);
  const nextHealth = clamp01(plant.health01 - healthDecay + healthRecovery);

  const draftPlant: Plant = {
    ...plant,
    ageHours: nextAge,
    biomass_g: nextBiomass,
    health01: nextHealth
  };

  let nextStage: PlantLifecycleStage = plant.lifecycleStage;

  if (
    nextStage === 'seedling' &&
    shouldTransitionToVegetative(draftPlant, zone.lightSchedule, strain.stageChangeThresholds.vegetative)
  ) {
    nextStage = 'vegetative';
  }

  if (
    nextStage === 'vegetative' &&
    shouldTransitionToFlowering(
      { ...draftPlant, lifecycleStage: nextStage },
      zone,
      strain.stageChangeThresholds.flowering
    )
  ) {
    nextStage = 'flowering';
  }

  if (
    nextStage === 'flowering' &&
    shouldTransitionToHarvestReady(
      { ...draftPlant, lifecycleStage: nextStage },
      zone,
      strain.phaseDurations
    )
  ) {
    nextStage = 'harvest-ready';
  }

  const stageChanged = nextStage !== plant.lifecycleStage;
  const ageChanged = hasNumericChange(plant.ageHours, nextAge);
  const biomassChanged = hasNumericChange(plant.biomass_g, nextBiomass);
  const healthChanged = hasNumericChange(plant.health01, nextHealth);

  if (!stageChanged && !ageChanged && !biomassChanged && !healthChanged) {
    return plant;
  }

  return {
    ...plant,
    ageHours: nextAge,
    biomass_g: nextBiomass,
    health01: nextHealth,
    lifecycleStage: nextStage
  } satisfies Plant;
}

export function advancePhysiology(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime: PhysiologyRuntime = {
    strainBlueprints: new Map()
  };

  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let zonesChanged = false;

      const nextZones = room.zones.map((zone) => {
        let plantsChanged = false;
        const nextPlants: Plant[] = [];

        for (const plant of zone.plants) {
          const strain = getOrLoadStrainBlueprint(plant.strainId, runtime);

          if (!strain) {
            const agedPlant = (() => {
              const nextAge = plant.ageHours + tickHours;

              if (!hasNumericChange(plant.ageHours, nextAge)) {
                return plant;
              }

              return {
                ...plant,
                ageHours: nextAge
              } satisfies Plant;
            })();

            ctx.diagnostics?.emit({
              scope: 'zone',
              code: 'plant.strain.missing',
              zoneId: zone.id,
              message: 'Strain blueprint not found for plant.',
              metadata: { plantId: plant.id, strainId: plant.strainId }
            });
            nextPlants.push(agedPlant);

            if (agedPlant !== plant) {
              plantsChanged = true;
            }
            continue;
          }

          const nextPlant = updatePlantPhysiology(plant, zone, strain, tickHours, world.seed);
          nextPlants.push(nextPlant);

          if (nextPlant !== plant) {
            plantsChanged = true;
          }
        }

        if (!plantsChanged) {
          return zone;
        }

        zonesChanged = true;
        return {
          ...zone,
          plants: nextPlants
        } satisfies Zone;
      });

      if (!zonesChanged) {
        return room;
      }

      roomsChanged = true;
      return {
        ...room,
        zones: nextZones
      };
    });

    if (!roomsChanged) {
      return structure;
    }

    structuresChanged = true;
    return {
      ...structure,
      rooms: nextRooms
    };
  });

  if (!structuresChanged) {
    return world;
  }

  return {
    ...world,
    company: {
      ...world.company,
      structures: nextStructures
    }
  } satisfies SimulationWorld;
}
