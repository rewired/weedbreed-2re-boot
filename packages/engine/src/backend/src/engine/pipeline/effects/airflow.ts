import type { AirflowActuatorInputs, FiltrationUnitInputs } from '../../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../../domain/entities.ts';
import { createAirflowActuatorStub, createFiltrationStub } from '../../../stubs/index.ts';
import { clamp01 } from '../../../util/math.ts';
import { DEFAULT_DEVICE_CONDITION01 } from '../../../constants/validation.ts';
import type { ZoneAggregationState } from '../aggregate/zoneEffects.ts';
import { recordAirflowDelivery, recordAirflowReduction } from '../aggregate/zoneEffects.ts';

function deriveAirflowInputs(device: ZoneDeviceInstance): AirflowActuatorInputs | null {
  const effects = device.effects ?? [];
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (duty01 <= 0) {
    return null;
  }

  if (effects.includes('airflow') && device.effectConfigs?.airflow) {
    const config = device.effectConfigs.airflow;

    if (!Number.isFinite(config.airflow_m3_per_h) || config.airflow_m3_per_h <= 0) {
      return null;
    }

    return {
      airflow_m3_per_h: config.airflow_m3_per_h,
      mode: config.mode,
      dutyCycle01: duty01
    } satisfies AirflowActuatorInputs;
  }

  const legacyAirflow = Number.isFinite(device.airflow_m3_per_h) ? device.airflow_m3_per_h : 0;

  if (legacyAirflow <= 0) {
    return null;
  }

  return {
    airflow_m3_per_h: legacyAirflow,
    mode: 'exhaust',
    dutyCycle01: duty01
  } satisfies AirflowActuatorInputs;
}

function deriveFiltrationInputs(
  device: ZoneDeviceInstance,
  upstreamAirflow_m3_per_h: number
): FiltrationUnitInputs | null {
  const effects = device.effects ?? [];

  if (!effects.includes('filtration') || !device.effectConfigs?.filtration) {
    return null;
  }

  const config = device.effectConfigs.filtration;
  const condition01 = clamp01(
    Number.isFinite(device.condition01) ? device.condition01 : DEFAULT_DEVICE_CONDITION01
  );

  return {
    airflow_m3_per_h: upstreamAirflow_m3_per_h,
    filterType: config.filterType,
    efficiency01: config.efficiency01,
    condition01,
    basePressureDrop_pa: config.basePressureDrop_pa
  } satisfies FiltrationUnitInputs;
}

export function applyAirflowAndFiltrationEffect(
  device: ZoneDeviceInstance,
  state: ZoneAggregationState,
  tickHours: number
): void {
  const airflowInputs = deriveAirflowInputs(device);
  let deviceAirflow_m3_per_h = 0;

  if (airflowInputs) {
    const airflowStub = createAirflowActuatorStub();
    const { effective_airflow_m3_per_h } = airflowStub.computeEffect(
      airflowInputs,
      state.volume_m3,
      tickHours
    );
    deviceAirflow_m3_per_h = effective_airflow_m3_per_h;

    if (deviceAirflow_m3_per_h > 0) {
      recordAirflowDelivery(state, deviceAirflow_m3_per_h);
    }
  }

  const filtrationInputs = deriveFiltrationInputs(device, state.runningAirflow_m3_per_h);

  if (!filtrationInputs) {
    return;
  }

  const filtrationStub = createFiltrationStub();
  const {
    airflow_reduction_m3_per_h,
    odor_concentration_delta,
    particulateRemoval01
  } = filtrationStub.computeEffect(filtrationInputs, tickHours);

  recordAirflowReduction(state, airflow_reduction_m3_per_h);

  const currentOdor = state.runtime.zoneOdorDelta.get(state.zone.id) ?? 0;
  state.runtime.zoneOdorDelta.set(state.zone.id, currentOdor + odor_concentration_delta);

  const currentParticulate = state.runtime.zoneParticulateRemoval01.get(state.zone.id) ?? 0;
  state.runtime.zoneParticulateRemoval01.set(
    state.zone.id,
    currentParticulate + particulateRemoval01
  );
}
