import { HOURS_PER_TICK } from '../constants/simConstants.js';
import type { EngineRunContext } from './Engine.js';

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function resolveTickHours(ctx: EngineRunContext): number {
  const candidate =
    (ctx as { tickDurationHours?: unknown }).tickDurationHours ??
    (ctx as { tickHours?: unknown }).tickHours;

  if (isPositiveFinite(candidate)) {
    return candidate;
  }

  return HOURS_PER_TICK;
}
