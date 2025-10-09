import {
  CLIMATE_BLUEPRINT,
  CONTAINER_BLUEPRINTS,
  CULTIVATION_BLUEPRINTS,
  IRRIGATION_BLUEPRINTS,
  LIGHT_BLUEPRINT,
  STRAIN_BLUEPRINTS,
  SUBSTRATE_BLUEPRINTS,
} from '../blueprintImports.ts';
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
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'white-widow', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: 24,
    cycleLengthDays: 56,
  },
  {
    id: 'b1c8c08a-850a-4d85-bd3b-aed02716f6d1',
    slug: 'zone-2',
    name: 'East Bench',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'sour-diesel', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'top-feed-pump-timer', 'irrigation'),
    firstHarvestDay: 26,
    cycleLengthDays: 63,
  },
  {
    id: 'c9b641d0-5f66-4f43-a16d-4695e07d54d3',
    slug: 'zone-3',
    name: 'Central Trellis',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'northern-lights', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'basic-soil-pot', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-10l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-single-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'manual-watering-can', 'irrigation'),
    firstHarvestDay: 28,
    cycleLengthDays: 52,
  },
  {
    id: 'd2d7410f-7d68-4fb0-8a42-221d787600f1',
    slug: 'zone-4',
    name: 'West Bench',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'ak47', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'ebb-flow-table-small', 'irrigation'),
    firstHarvestDay: 30,
    cycleLengthDays: 60,
  },
  {
    id: 'e84a23d8-9d3e-49d6-a1c6-261e7f4bb9b2',
    slug: 'zone-5',
    name: 'South Canopy',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'skunk-1', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: 32,
    cycleLengthDays: 58,
  },
];
