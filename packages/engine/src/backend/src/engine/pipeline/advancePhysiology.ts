import { FLOAT_TOLERANCE } from '../../constants/simConstants.js';
import type {
  Plant,
  PlantLifecycleStage,
  Room,
  SimulationWorld,
  Structure,
  Uuid,
  Zone
} from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import type { StrainBlueprint } from '../../domain/blueprints/strainBlueprint.js';
import { loadStrainBlueprint } from '../../domain/blueprints/strainBlueprintLoader.js';
import { createRng } from '../../util/rng.js';
import {
  calculateBiomassIncrement,
  calculateHealthDecay,
  calculateHealthRecovery
} from '../../util/growth.js';
import { calculateCombinedStress } from '../../physiology/stressModel.js';
import {
  shouldTransitionToFlowering,
  shouldTransitionToHarvestReady,
  shouldTransitionToVegetative
} from '../../util/photoperiod.js';
import { resolveTickHours } from '../resolveTickHours.js';
import { clamp01 } from '../../util/math.js';

interface PhysiologyRuntime {
  readonly strainBlueprints: Map<Uuid, StrainBlueprint>;
}

function getOrLoadStrainBlueprint(
  strainId: Uuid,
  runtime: PhysiologyRuntime
): StrainBlueprint | null {
  const cached = runtime.strainBlueprints.get(strainId);

  if (cached) {
    return cached;
  }

  const blueprint = loadStrainBlueprint(strainId);

  if (blueprint) {
    runtime.strainBlueprints.set(strainId, blueprint);
  }

  return blueprint;
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
  if (plant.status === 'harvested') {
    return plant;
  }

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
  const readyForHarvest = nextStage === 'harvest-ready';
  const readyChanged = (plant.readyForHarvest === true) !== readyForHarvest;
  const nextStatus = plant.status ?? 'active';

  if (!stageChanged && !ageChanged && !biomassChanged && !healthChanged && !readyChanged) {
    return plant;
  }

  return {
    ...plant,
    ageHours: nextAge,
    biomass_g: nextBiomass,
    health01: nextHealth,
    lifecycleStage: nextStage,
    readyForHarvest,
    status: nextStatus
  } satisfies Plant;
}

export function advancePhysiology(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime: PhysiologyRuntime = {
    strainBlueprints: new Map()
  };

  let structuresChangedFlag = 0;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChangedFlag = 0;

    const nextRooms = structure.rooms.map((room) => {
      let zonesChangedFlag = 0;

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

        zonesChangedFlag = 1;
        return {
          ...zone,
          plants: nextPlants
        } satisfies Zone;
      });

      if (zonesChangedFlag === 0) {
        return room;
      }

      roomsChangedFlag = 1;
      return {
        ...room,
        zones: nextZones
      } satisfies Room;
    });

    if (roomsChangedFlag === 0) {
      return structure;
    }

    structuresChangedFlag = 1;
    return {
      ...structure,
      rooms: nextRooms
    } satisfies Structure;
  });

  if (structuresChangedFlag === 0) {
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
