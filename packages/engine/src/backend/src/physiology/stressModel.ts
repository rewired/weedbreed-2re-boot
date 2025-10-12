import type { PlantLifecycleStage, ZoneEnvironment } from '../domain/entities.ts';
import type { EnvBand, StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import { clamp01 } from '../util/math.ts';
import { computeVpd_kPa } from './vpd.ts';

function toStageEnvBand(
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage,
  accessor: (bands: StrainBlueprint['envBands']['default']) => EnvBand | undefined
): EnvBand | undefined {
  const { envBands } = strain;

  switch (lifecycleStage) {
    case 'flowering':
    case 'harvest-ready': {
      const candidate = envBands.flower ? accessor(envBands.flower) : undefined;
      return candidate ?? accessor(envBands.default);
    }

    case 'seedling':
    case 'vegetative': {
      const candidate = envBands.veg ? accessor(envBands.veg) : undefined;
      return candidate ?? accessor(envBands.default);
    }

    default:
      return accessor(envBands.default);
  }
}

function quadraticRamp(distance: number, threshold: number, tolerance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) {
    return 0;
  }

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 1;
  }

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return clamp01(distance / threshold);
  }

  const thresholdRatio = clamp01(distance / threshold);
  const toleranceRatio = clamp01(distance / tolerance);
  const easedTolerance = toleranceRatio * toleranceRatio;

  return clamp01(Math.max(thresholdRatio, easedTolerance));
}

function evaluateBandStress(value: number, band: EnvBand | undefined, tolerance: number): number {
  if (!band) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  const [greenMin, greenMax] = band.green;

  if (value >= greenMin && value <= greenMax) {
    return 0;
  }

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return 1;
  }

  if (value < greenMin) {
    if (value <= band.yellowLow) {
      return 1;
    }

    const distance = greenMin - value;
    const threshold = greenMin - band.yellowLow;
    return quadraticRamp(distance, threshold, tolerance);
  }

  if (value >= band.yellowHigh) {
    return 1;
  }

  const distance = value - greenMax;
  const threshold = band.yellowHigh - greenMax;
  return quadraticRamp(distance, threshold, tolerance);
}

export function calculateTemperatureStress(
  tempC: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.temp_C);
  return evaluateBandStress(tempC, band, strain.stressTolerance.temp_C);
}

export function calculateLightStress(
  ppfd: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.ppfd_umol_m2s);
  return evaluateBandStress(ppfd, band, strain.stressTolerance.ppfd_umol_m2s);
}

export function calculateHumidityStress(
  relativeHumidity01: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.rh_frac);

  if (!band) {
    return 0;
  }

  const humidityFraction = clamp01(relativeHumidity01);
  return evaluateBandStress(humidityFraction, band, strain.stressTolerance.rh_frac);
}

export function calculateVpdStress(
  environment: ZoneEnvironment,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number | null {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.vpd_kPa);

  if (!band) {
    return null;
  }

  const vpd = computeVpd_kPa(environment.airTemperatureC, environment.relativeHumidity01);
  return evaluateBandStress(vpd, band, strain.stressTolerance.vpd_kPa);
}

export function calculateCombinedStress(
  environment: ZoneEnvironment,
  ppfd: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const contributions: number[] = [];

  contributions.push(calculateTemperatureStress(environment.airTemperatureC, strain, lifecycleStage));

  const vpdStress = calculateVpdStress(environment, strain, lifecycleStage);

  if (vpdStress !== null) {
    contributions.push(vpdStress);
  } else {
    contributions.push(calculateHumidityStress(environment.relativeHumidity01, strain, lifecycleStage));
  }

  contributions.push(calculateLightStress(ppfd, strain, lifecycleStage));

  if (contributions.length === 0) {
    return 0;
  }

  const total = contributions.reduce((sum, value) => sum + value, 0);
  return clamp01(total / contributions.length);
}
