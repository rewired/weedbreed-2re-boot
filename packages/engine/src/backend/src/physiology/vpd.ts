import { clamp01 } from '../util/math.js';

const SATURATION_COEFF_A = 17.27;
const SATURATION_COEFF_B_C = 237.3;
const SATURATION_BASE_KPA = 0.6108;
const MIN_RELATIVE_HUMIDITY_FRACTION = 1e-6;
const MAX_RELATIVE_HUMIDITY_FRACTION = 1 - MIN_RELATIVE_HUMIDITY_FRACTION;

function clampRelativeHumidityFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_RELATIVE_HUMIDITY_FRACTION;
  }

  if (value <= 0) {
    return MIN_RELATIVE_HUMIDITY_FRACTION;
  }

  if (value >= 1) {
    return MAX_RELATIVE_HUMIDITY_FRACTION;
  }

  return value;
}

function magnusExponent(tempC: number): number {
  return (SATURATION_COEFF_A * tempC) / (tempC + SATURATION_COEFF_B_C);
}

/**
 * Computes saturation vapour pressure for a given temperature using the
 * Magnus-Tetens approximation expressed in kilopascals.
 */
export function computeSaturationVapourPressure_kPa(tempC: number): number {
  if (!Number.isFinite(tempC)) {
    return 0;
  }

  const exponent = magnusExponent(tempC);
  const pressure = SATURATION_BASE_KPA * Math.exp(exponent);

  if (!Number.isFinite(pressure) || pressure <= 0) {
    return 0;
  }

  return pressure;
}

/**
 * Computes the dew point temperature in degrees Celsius for the provided
 * dry-bulb temperature and relative humidity fraction.
 */
export function computeDewPoint_C(tempC: number, relativeHumidity01: number): number {
  if (!Number.isFinite(tempC)) {
    tempC = 0;
  }

  const clampedHumidity = clampRelativeHumidityFraction(relativeHumidity01);
  const saturationExponent = magnusExponent(tempC);
  const gamma = Math.log(clampedHumidity) + saturationExponent;
  const denominator = SATURATION_COEFF_A - gamma;

  if (Math.abs(denominator) < Number.EPSILON) {
    return tempC;
  }

  const dewPoint = (SATURATION_COEFF_B_C * gamma) / denominator;

  if (!Number.isFinite(dewPoint)) {
    return tempC;
  }

  return dewPoint;
}

/**
 * Computes the vapour pressure deficit in kilopascals for the provided
 * dry-bulb temperature and relative humidity percentage.
 */
export function computeVpd_kPa(tempC: number, relativeHumidity_pct: number): number {
  const saturation = computeSaturationVapourPressure_kPa(tempC);
  const humidityFraction = clamp01(relativeHumidity_pct / 100);
  const vapourPressure = saturation * humidityFraction;
  const deficit = saturation - vapourPressure;

  if (!Number.isFinite(deficit) || deficit <= 0) {
    return 0;
  }

  return deficit;
}
