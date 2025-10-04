import { HOURS_PER_TICK } from '../constants/simConstants.js';
import type { EngineRunContext } from './Engine.js';

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function resolveTickHoursValue(value: unknown): number {
  if (isPositiveFinite(value)) {
    return value;
  }

  return HOURS_PER_TICK;
}

export function resolveTickHours(ctx: EngineRunContext): number {
  const candidate =
    (ctx as { tickDurationHours?: unknown }).tickDurationHours ??
    (ctx as { tickHours?: unknown }).tickHours;

  return resolveTickHoursValue(candidate);
}
