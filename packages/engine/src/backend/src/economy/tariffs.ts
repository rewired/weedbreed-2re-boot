import utilityPrices from '../../../../../../data/prices/utilityPrices.json' with { type: 'json' };

import type { EngineRunContext } from '../engine/Engine.ts';
import { resolveTariffs, type ResolvedTariffs } from '../util/tariffs.ts';

type TariffCarrier = EngineRunContext & { tariffs?: ResolvedTariffs };

const FALLBACK_TARIFFS: ResolvedTariffs = resolveTariffs({
  price_electricity: Number(utilityPrices.price_electricity),
  price_water: Number(utilityPrices.price_water)
});

export function resolveEffectiveTariffs(ctx: EngineRunContext): ResolvedTariffs {
  const carrier = ctx as TariffCarrier;
  const tariffs = carrier.tariffs;

  if (tariffs) {
    return tariffs;
  }

  return FALLBACK_TARIFFS;
}
