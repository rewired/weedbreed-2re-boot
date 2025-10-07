import { HOURS_PER_DAY, LIGHT_SCHEDULE_GRID_HOURS } from '../constants/simConstants.js';
import type { LightSchedule, Plant, Zone } from '../domain/entities.js';
import type { PhaseDurations, StageChangeThresholds } from '../domain/blueprints/strainBlueprint.js';

function normaliseHour(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const wrapped = value % HOURS_PER_DAY;

  if (wrapped < 0) {
    return wrapped + HOURS_PER_DAY;
  }

  return wrapped;
}

function clampLightWindow(hours: number): number {
  if (!Number.isFinite(hours)) {
    return 0;
  }

  if (hours <= 0) {
    return 0;
  }

  if (hours >= HOURS_PER_DAY) {
    return HOURS_PER_DAY;
  }

  return hours;
}

/**
 * Determines whether the light schedule is currently in its "on" window.
 *
 * @param simTimeHours - Absolute simulation time expressed in hours.
 * @param schedule - Deterministic light schedule applied to the zone.
 * @returns `true` when the light cycle is active at the provided time.
 */
export function isLightOn(simTimeHours: number, schedule: LightSchedule): boolean {
  const onDuration = clampLightWindow(schedule.onHours);

  if (onDuration <= 0) {
    return false;
  }

  if (onDuration >= HOURS_PER_DAY) {
    return true;
  }

  const hourOfDay = normaliseHour(simTimeHours);
  const start = normaliseHour(schedule.startHour);
  const end = normaliseHour(start + onDuration);

  if (start === end) {
    return true;
  }

  if (end > start) {
    return hourOfDay >= start && hourOfDay < end;
  }

  return hourOfDay >= start || hourOfDay < end;
}

/**
 * Accumulates the total amount of light hours a plant has been exposed to.
 *
 * The function integrates over whole days analytically and samples the
 * remainder of the current day using the SEC-mandated 15-minute grid.
 *
 * @param ageHours - Plant age expressed in in-game hours.
 * @param schedule - Light schedule applied to the zone.
 * @returns Number of hours lights have been on during the provided age horizon.
 */
export function calculateAccumulatedLightHours(ageHours: number, schedule: LightSchedule): number {
  if (!Number.isFinite(ageHours) || ageHours <= 0) {
    return 0;
  }

  const onDuration = clampLightWindow(schedule.onHours);

  if (onDuration <= 0) {
    return 0;
  }

  const fullDays = Math.floor(ageHours / HOURS_PER_DAY);
  let total = fullDays * onDuration;
  const remainder = ageHours - fullDays * HOURS_PER_DAY;

  if (remainder <= 0) {
    return total;
  }

  const step = Math.max(1e-6, Math.min(LIGHT_SCHEDULE_GRID_HOURS, remainder));
  const baseTime = fullDays * HOURS_PER_DAY;

  for (let cursor = 0; cursor < remainder - 1e-9; cursor += step) {
    const slice = Math.min(step, remainder - cursor);
    const sampleTime = baseTime + cursor + slice / 2;

    if (isLightOn(sampleTime, schedule)) {
      total += slice;
    }
  }

  return total;
}

/**
 * Determines whether a seedling should progress into the vegetative stage.
 */
export function shouldTransitionToVegetative(
  plant: Plant,
  schedule: LightSchedule,
  thresholds: StageChangeThresholds['vegetative']
): boolean {
  if (plant.lifecycleStage !== 'seedling') {
    return false;
  }

  const lightHours = calculateAccumulatedLightHours(plant.ageHours, schedule);

  return lightHours >= thresholds.minLightHours;
}

/**
 * Determines whether a vegetative plant should transition to flowering.
 */
export function shouldTransitionToFlowering(
  plant: Plant,
  zone: Zone,
  thresholds: StageChangeThresholds['flowering']
): boolean {
  if (plant.lifecycleStage !== 'vegetative') {
    return false;
  }

  if (zone.photoperiodPhase !== 'flowering') {
    return false;
  }

  const lightHours = calculateAccumulatedLightHours(plant.ageHours, zone.lightSchedule);

  return lightHours >= thresholds.minLightHours;
}

/**
 * Determines whether a flowering plant is ready for harvest.
 */
export function shouldTransitionToHarvestReady(
  plant: Plant,
  zone: Zone,
  phaseDurations: PhaseDurations
): boolean {
  void zone;

  if (plant.lifecycleStage !== 'flowering') {
    return false;
  }

  const thresholdHours =
    (phaseDurations.seedlingDays + phaseDurations.vegDays + phaseDurations.flowerDays) * HOURS_PER_DAY;

  return plant.ageHours >= thresholdHours;
}
