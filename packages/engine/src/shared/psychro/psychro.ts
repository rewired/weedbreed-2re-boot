import psychrolib from 'psychrolib';

const PSY = psychrolib;

if (PSY.GetUnitSystem?.() !== PSY.SI) {
  PSY.SetUnitSystem(PSY.SI);
}

const PA_PER_KPA = 1_000;

/**
 * Compute the vapour pressure deficit (kPa) for a dry-bulb temperature in °C
 * and a relative humidity percentage.
 */
export function computeVpd_kPa(T_c: number, RH_pct: number): number {
  const relHum01 = RH_pct / 100;
  const saturation = PSY.GetSatVapPres(T_c);
  const vapour = PSY.GetVapPresFromRelHum(T_c, relHum01);

  return (saturation - vapour) / PA_PER_KPA;
}
