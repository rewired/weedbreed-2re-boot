import psychrolib from 'psychrolib';

const PSY = psychrolib;

// `psychrolib` defaults to IP on first import; align with SEC SI expectations.
if (PSY.GetUnitSystem?.() !== PSY.SI) {
  PSY.SetUnitSystem(PSY.SI);
}

const PA_PER_KPA = 1_000;

/**
 * Computes the vapour pressure deficit (VPD) in kilopascals for a given
 * dry-bulb temperature and relative humidity.
 *
 * @param T_c - Dry-bulb temperature in degrees Celsius (°C).
 * @param RH_pct - Relative humidity in percent within the `[0, 100]` range.
 * @returns The vapour pressure deficit in kilopascals (kPa).
 * @remarks Test-only helper captured by Task 0009 until psychrometric wiring
 *   into the live pipeline receives ADR sign-off and `psychrolib` publishes a
 *   maintained v2 release. Behaviour aligns with SEC §6 environment modelling
 *   units.
 */
export function computeVpd_kPa(T_c: number, RH_pct: number): number {
  const relHum01 = RH_pct / 100;
  const saturation = PSY.GetSatVapPres(T_c);
  const vapour = PSY.GetVapPresFromRelHum(T_c, relHum01);

  return (saturation - vapour) / PA_PER_KPA;
}
