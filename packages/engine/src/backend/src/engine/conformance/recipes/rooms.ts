import type { ZonePlan } from '../types.ts';

import { ZONE_PLANS } from './zones.ts';
import { DEFAULT_RECIPE_ROOM_HEIGHT_M, DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2 } from '../../../constants/simConstants.ts';

export interface RoomRecipe {
  readonly id: string;
  readonly slug: string;
  readonly purpose: 'growroom' | 'storageroom' | 'breakroom';
  readonly floorArea_m2: number;
  readonly height_m: number;
  readonly zones: readonly ZonePlan[];
}

export const COMPANY_ID = '5d1f24be-9565-4e50-956b-16d4f557c6df';
export const STRUCTURE_ID = '1c6c5e04-0d0c-4c59-b7d3-dfb2f548f8a8';
export const GROW_ROOM_ID = '7f43b718-86bd-4dc6-92f4-01a08357b6f4';
export const STORAGE_ROOM_ID = 'c4545aab-8e71-4d39-bb3c-e9c5ce3d6f56';
export const BREAK_ROOM_ID = '8c3c2f06-6c5a-4f36-8f43-52a6901c1d3a';

export const ROOM_RECIPES: readonly RoomRecipe[] = [
  {
    id: GROW_ROOM_ID,
    slug: 'grow-room',
    purpose: 'growroom',
    floorArea_m2: 100,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    zones: ZONE_PLANS,
  },
  {
    id: STORAGE_ROOM_ID,
    slug: 'storage-room',
    purpose: 'storageroom',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    zones: [],
  },
  {
    id: BREAK_ROOM_ID,
    slug: 'break-room',
    purpose: 'breakroom',
    floorArea_m2: DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
    height_m: DEFAULT_RECIPE_ROOM_HEIGHT_M,
    zones: [],
  },
];
