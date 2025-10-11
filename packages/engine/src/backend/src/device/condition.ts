/**
 * Device condition lifecycle helpers.
 *
 * These are deliberately lightweight placeholders until the full SEC quality /
 * condition models are implemented. They provide deterministic, monotonic wear
 * relative to `quality01`, enforce threshold checks for maintenance/repairs, and
 * expose RNG-ready hooks so future probabilistic repair flows can integrate
 * without rewriting call sites.
 */

import { clamp01 } from '../util/math.ts';

const BASE_WEAR_RATE01 = 0.01;
const QUALITY_WEAR_SLOPE = 0.5;
const DEFAULT_REPAIR_SUCCESS_THRESHOLD01 = 0.5;

export interface RepairOptions {
  readonly condition01: number;
  readonly repairMinThreshold01: number;
  readonly repairAmount01: number;
  readonly successChance01?: number;
  readonly sampleSuccess?: (chance01: number) => boolean;
}

export interface RepairResult {
  readonly condition01: number;
  readonly success: boolean;
}

export function degradeCondition(
  condition01: number,
  quality01: number,
  wearMultiplier = 1
): number {
  assertFinite('condition01', condition01);
  assertFinite('quality01', quality01);
  assertFinite('wearMultiplier', wearMultiplier);

  const condition = clamp01(condition01);
  const quality = clamp01(quality01);
  const multiplier = Math.max(0, wearMultiplier);

  const wearRate = BASE_WEAR_RATE01 * multiplier * (1 + QUALITY_WEAR_SLOPE * (1 - quality));
  const degraded = condition - wearRate;

  return clamp01(degraded);
}

export function needsMaintenance(condition01: number, maintThreshold01: number): boolean {
  assertFinite('condition01', condition01);
  assertFinite('maintThreshold01', maintThreshold01);

  const condition = clamp01(condition01);
  const threshold = clamp01(maintThreshold01);

  return condition <= threshold;
}

export function canRepair(condition01: number, repairMinThreshold01: number): boolean {
  assertFinite('condition01', condition01);
  assertFinite('repairMinThreshold01', repairMinThreshold01);

  const condition = clamp01(condition01);
  const threshold = clamp01(repairMinThreshold01);

  return condition >= threshold;
}

export function applyRepair(options: RepairOptions): RepairResult {
  const condition = clamp01(options.condition01);
  const threshold = clamp01(options.repairMinThreshold01);
  const amount = Math.max(0, options.repairAmount01);
  const successChance = clamp01(options.successChance01 ?? 1);

  if (!canRepair(condition, threshold)) {
    return { condition01: condition, success: false };
  }

  const success = determineRepairSuccess(successChance, options.sampleSuccess);

  if (!success) {
    return { condition01: condition, success: false };
  }

  const repaired = clamp01(condition + amount);

  return { condition01: repaired, success: true };
}

function determineRepairSuccess(
  successChance01: number,
  sampleSuccess: RepairOptions['sampleSuccess']
): boolean {
  if (successChance01 <= 0) {
    return false;
  }

  if (successChance01 >= 1) {
    return true;
  }

  if (sampleSuccess) {
    return sampleSuccess(successChance01);
  }

  return successChance01 >= DEFAULT_REPAIR_SUCCESS_THRESHOLD01;
}

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}
