import climateJson from '../../../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import lightingJson from '../../../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import devicePricesJson from '../../../../../../../data/prices/devicePrices.json' with { type: 'json' };

import { parseDeviceBlueprint, type DeviceBlueprint } from '../../domain/blueprints/deviceBlueprint.ts';
import { parseDevicePriceMap, type DevicePriceEntry } from '../../domain/pricing/devicePriceMap.ts';
import type { Uuid } from '../../domain/entities.ts';

interface FacilityDeviceCatalogEntry {
  readonly blueprint: DeviceBlueprint;
  readonly price?: DevicePriceEntry;
}

let deviceCatalog: ReadonlyMap<Uuid, FacilityDeviceCatalogEntry> | undefined;

/** Device required to satisfy demo-zone lighting coverage. */
export const DEMO_LIGHTING_BLUEPRINT_ID = lightingJson.id as Uuid;

/** Device required to satisfy demo-zone climate coverage. */
export const DEMO_CLIMATE_BLUEPRINT_ID = climateJson.id as Uuid;

/** Loads the Journey-slice device catalog and separate canonical price map. */
export function loadFacilityDeviceCatalog(): ReadonlyMap<Uuid, FacilityDeviceCatalogEntry> {
  if (deviceCatalog) {
    return deviceCatalog;
  }

  const prices = parseDevicePriceMap(devicePricesJson).devicePrices;
  const blueprints = [parseDeviceBlueprint(lightingJson), parseDeviceBlueprint(climateJson)];
  deviceCatalog = new Map(blueprints.map((blueprint) => [
    blueprint.id as Uuid,
    { blueprint, price: prices[blueprint.id] } satisfies FacilityDeviceCatalogEntry,
  ]));

  return deviceCatalog;
}
