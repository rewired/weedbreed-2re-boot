import type { SimulationWorld, Uuid } from '../entities.ts';
import type { StrainBlueprint } from './strainBlueprint.ts';
import { loadStrainBlueprint } from './strainBlueprintLoader.ts';

/** A resolved strain and the state domain that supplied it. */
export interface ResolvedStrain {
  readonly source: 'static' | 'custom';
  readonly blueprint: StrainBlueprint;
}

/**
 * Resolves a strain for gameplay commands.
 * The world parameter is the stable extension seam for R-600 custom save-state strains.
 */
export function resolveStrain(
  world: SimulationWorld,
  strainId: Uuid,
): ResolvedStrain | null {
  const custom = world.breeding?.customStrainRegistry.find((strain) => strain.id === strainId);
  if (custom) return { source: 'custom', blueprint: custom };
  const blueprint = loadStrainBlueprint(strainId);
  return blueprint ? { source: 'static', blueprint } : null;
}
