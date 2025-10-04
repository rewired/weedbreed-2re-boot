import type { PlantLifecycleStage, ZoneEnvironment } from '../domain/entities.js';
import type { EnvBand, StrainBlueprint } from '../domain/blueprints/strainBlueprint.js';
import { clamp01 } from './math.js';

function toStageEnvBand(
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage,
  accessor: (bands: StrainBlueprint['envBands']['default']) => EnvBand | undefined
): EnvBand | undefined {
  const { envBands } = strain;

  if (lifecycleStage === 'flowering' || lifecycleStage === 'harvest-ready') {
    const candidate = envBands.flower ? accessor(envBands.flower) : undefined;
    return candidate ?? accessor(envBands.default);
  }

  if (lifecycleStage === 'seedling' || lifecycleStage === 'vegetative') {
    const candidate = envBands.veg ? accessor(envBands.veg) : undefined;
    return candidate ?? accessor(envBands.default);
  }

  return accessor(envBands.default);
}

function calculateDeviationStress(
  value: number,
  band: EnvBand,
  tolerance: number
): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const [greenMin, greenMax] = band.green;

  if (value >= greenMin && value <= greenMax) {
    return 0;
  }

  if (tolerance <= 0) {
    return 1;
  }

  if (value < greenMin) {
    if (value <= band.yellowLow) {
      return 1;
    }

    const span = greenMin - band.yellowLow;
    const relative = span > 0 ? (greenMin - value) / span : 1;
    const toleranceRatio = (greenMin - value) / tolerance;
    return clamp01(Math.max(relative, toleranceRatio));
  }

  if (value >= band.yellowHigh) {
    return 1;
  }

  const span = band.yellowHigh - greenMax;
  const relative = span > 0 ? (value - greenMax) / span : 1;
  const toleranceRatio = (value - greenMax) / tolerance;
  return clamp01(Math.max(relative, toleranceRatio));
}

/**
 * Computes stress for a given environmental reading relative to strain-specific bands.
 */
export function calculateEnvironmentalStress(
  currentValue: number,
  envBand: EnvBand | undefined,
  tolerance: number
): number {
  if (!envBand) {
    return 0;
  }

  if (!Number.isFinite(currentValue)) {
    return 0;
  }

  return calculateDeviationStress(currentValue, envBand, tolerance);
}

export function calculateTemperatureStress(
  tempC: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.temp_C);
  return calculateEnvironmentalStress(tempC, band, strain.stressTolerance.temp_C);
}

export function calculateHumidityStress(
  rhPct: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.rh_frac);

  if (!band) {
    return 0;
  }

  if (!Number.isFinite(rhPct)) {
    return 0;
  }

  const rhFraction = rhPct / 100;
  return calculateEnvironmentalStress(rhFraction, band, strain.stressTolerance.rh_frac);
}

export function calculateLightStress(
  ppfd: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const band = toStageEnvBand(strain, lifecycleStage, (scope) => scope.ppfd_umol_m2s);
  return calculateEnvironmentalStress(ppfd, band, strain.stressTolerance.ppfd_umol_m2s);
}

export function calculateCombinedStress(
  environment: ZoneEnvironment,
  ppfd: number,
  strain: StrainBlueprint,
  lifecycleStage: PlantLifecycleStage
): number {
  const temperatureStress = calculateTemperatureStress(environment.airTemperatureC, strain, lifecycleStage);
  const humidityStress = calculateHumidityStress(environment.relativeHumidity_pct, strain, lifecycleStage);
  const lightStress = calculateLightStress(ppfd, strain, lifecycleStage);
  const combined = (temperatureStress + humidityStress + lightStress) / 3;
  return clamp01(combined);
}
