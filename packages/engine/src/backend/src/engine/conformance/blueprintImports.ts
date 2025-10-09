import ledVegLightBlueprint from '../../../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import coolAirSplitBlueprint from '../../../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import dripInlineFertigationBlueprint from '../../../../../../../data/blueprints/irrigation/drip-inline-fertigation-basic.json' with { type: 'json' };
import ebbFlowTableBlueprint from '../../../../../../../data/blueprints/irrigation/ebb-flow-table-small.json' with { type: 'json' };
import manualWateringBlueprint from '../../../../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import topFeedPumpBlueprint from '../../../../../../../data/blueprints/irrigation/top-feed-pump-timer.json' with { type: 'json' };
import pot10LBlueprint from '../../../../../../../data/blueprints/container/pot-10l.json' with { type: 'json' };
import pot11LBlueprint from '../../../../../../../data/blueprints/container/pot-11l.json' with { type: 'json' };
import pot25LBlueprint from '../../../../../../../data/blueprints/container/pot-25l.json' with { type: 'json' };
import soilSingleCycleBlueprint from '../../../../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };
import soilMultiCycleBlueprint from '../../../../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import cocoCoirBlueprint from '../../../../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import seaOfGreenBlueprint from '../../../../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenBlueprint from '../../../../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import basicSoilPotBlueprint from '../../../../../../../data/blueprints/cultivation-method/basic-soil-pot.json' with { type: 'json' };
import ak47Strain from '../../../../../../../data/blueprints/strain/ak47.json' with { type: 'json' };
import sourDieselStrain from '../../../../../../../data/blueprints/strain/sour-diesel.json' with { type: 'json' };
import whiteWidowStrain from '../../../../../../../data/blueprints/strain/white-widow.json' with { type: 'json' };
import northernLightsStrain from '../../../../../../../data/blueprints/strain/northern-lights.json' with { type: 'json' };
import skunk1Strain from '../../../../../../../data/blueprints/strain/skunk-1.json' with { type: 'json' };

import type {
  ClimateBlueprint,
  ContainerBlueprint,
  CultivationBlueprint,
  IrrigationBlueprint,
  LightingBlueprint,
  StrainBlueprint,
  SubstrateBlueprint,
} from './types.ts';

export const LIGHT_BLUEPRINT = ledVegLightBlueprint as LightingBlueprint;
export const CLIMATE_BLUEPRINT = coolAirSplitBlueprint as ClimateBlueprint;

export const CULTIVATION_BLUEPRINTS = [
  seaOfGreenBlueprint,
  screenOfGreenBlueprint,
  basicSoilPotBlueprint,
] as readonly CultivationBlueprint[];

export const CONTAINER_BLUEPRINTS = [
  pot10LBlueprint,
  pot11LBlueprint,
  pot25LBlueprint,
] as readonly ContainerBlueprint[];

export const SUBSTRATE_BLUEPRINTS = [
  soilSingleCycleBlueprint,
  soilMultiCycleBlueprint,
  cocoCoirBlueprint,
] as readonly SubstrateBlueprint[];

export const IRRIGATION_BLUEPRINTS = [
  dripInlineFertigationBlueprint,
  ebbFlowTableBlueprint,
  manualWateringBlueprint,
  topFeedPumpBlueprint,
] as readonly IrrigationBlueprint[];

export const STRAIN_BLUEPRINTS = [
  whiteWidowStrain,
  sourDieselStrain,
  northernLightsStrain,
  ak47Strain,
  skunk1Strain,
] as readonly StrainBlueprint[];
