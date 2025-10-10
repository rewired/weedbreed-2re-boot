import utilityPrices from '../../../../../../data/prices/utilityPrices.json' with { type: 'json' };

import type { EngineRunContext } from '../engine/Engine.ts';
import { resolveTariffs, type ResolvedTariffs } from '../util/tariffs.ts';

function requireUtilityPrice(value: unknown, field: 'price_electricity' | 'price_water'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`utilityPrices.${field} must be a finite number.`);
  }

  if (value < 0) {
    throw new RangeError(`utilityPrices.${field} must be non-negative.`);
  }

  return value;
}

type TariffCarrier = EngineRunContext & { tariffs?: ResolvedTariffs };

const FALLBACK_TARIFFS: ResolvedTariffs = resolveTariffs({
  price_electricity: requireUtilityPrice(utilityPrices.price_electricity, 'price_electricity'),
  price_water: requireUtilityPrice(utilityPrices.price_water, 'price_water')
});

export function resolveEffectiveTariffs(ctx: EngineRunContext): ResolvedTariffs {
  const carrier = ctx as TariffCarrier;
  const tariffs = carrier.tariffs;

  if (tariffs) {
    return tariffs;
  }

  return FALLBACK_TARIFFS;
}
