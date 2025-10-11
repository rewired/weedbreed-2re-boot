import {
  CONTAINER_BLUEPRINTS,
  CULTIVATION_BLUEPRINTS,
  IRRIGATION_BLUEPRINTS,
  STRAIN_BLUEPRINTS,
  SUBSTRATE_BLUEPRINTS,
} from '../blueprintImports.ts';
import {
  DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
  DEFAULT_RECIPE_ROOM_HEIGHT_M,
  ZONE_1_FIRST_HARVEST_DAY,
  ZONE_1_CYCLE_LENGTH_DAYS,
  ZONE_2_FIRST_HARVEST_DAY,
  ZONE_2_CYCLE_LENGTH_DAYS,
  ZONE_3_FIRST_HARVEST_DAY,
  ZONE_3_CYCLE_LENGTH_DAYS,
  ZONE_4_FIRST_HARVEST_DAY,
  ZONE_4_CYCLE_LENGTH_DAYS,
  ZONE_5_FIRST_HARVEST_DAY,
  ZONE_5_CYCLE_LENGTH_DAYS
} from '../../../constants/simConstants.ts';
import type { ZonePlan } from '../types.ts';

export { CLIMATE_BLUEPRINT, LIGHT_BLUEPRINT } from '../blueprintImports.ts';

function requireBlueprint<T extends { readonly slug: string }>(
  list: readonly T[],
  slug: string,
  kind: string
): T {
  const blueprint = list.find((entry) => entry.slug === slug);

  if (!blueprint) {
    throw new Error(`Missing ${kind} blueprint for slug "${slug}".`);
  }

  return blueprint;
}

export const ZONE_PLANS: readonly ZonePlan[] = [
  {
    id: 'a4be1f8d-63b7-4f08-9dcb-61e3f6b5bdc0',
    slug: 'zone-1',
    name: 'North Canopy',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'white-widow', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: ZONE_1_FIRST_HARVEST_DAY,
    cycleLengthDays: ZONE_1_CYCLE_LENGTH_DAYS,
  },
  {
    id: 'b1c8c08a-850a-4d85-bd3b-aed02716f6d1',
    slug: 'zone-2',
    name: 'East Bench',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'sour-diesel', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'top-feed-pump-timer', 'irrigation'),
    firstHarvestDay: ZONE_2_FIRST_HARVEST_DAY,
    cycleLengthDays: ZONE_2_CYCLE_LENGTH_DAYS,
  },
  {
    id: 'c9b641d0-5f66-4f43-a16d-4695e07d54d3',
    slug: 'zone-3',
    name: 'Central Trellis',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'northern-lights', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'basic-soil-pot', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-10l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-single-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'manual-watering-can', 'irrigation'),
    firstHarvestDay: ZONE_3_FIRST_HARVEST_DAY,
    cycleLengthDays: ZONE_3_CYCLE_LENGTH_DAYS,
  },
  {
    id: 'd2d7410f-7d68-4fb0-8a42-221d787600f1',
    slug: 'zone-4',
    name: 'West Bench',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'ak47', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'ebb-flow-table-small', 'irrigation'),
    firstHarvestDay: ZONE_4_FIRST_HARVEST_DAY,
    cycleLengthDays: ZONE_4_CYCLE_LENGTH_DAYS,
  },
  {
    id: 'e84a23d8-9d3e-49d6-a1c6-261e7f4bb9b2',
    slug: 'zone-5',
    name: 'South Canopy',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'skunk-1', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: ZONE_5_FIRST_HARVEST_DAY,
    cycleLengthDays: ZONE_5_CYCLE_LENGTH_DAYS,
  },
];
