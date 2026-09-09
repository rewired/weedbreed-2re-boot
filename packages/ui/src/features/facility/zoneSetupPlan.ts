import type { DevicePriceEntry, PriceBookCatalog, ZoneReadModel } from "@ui/state/readModels.types";

export const DEMO_SETUP_DEVICES = [
  { blueprintId: "3b5f6ad7-672e-47cd-9a24-f0cc45c4101e", slug: "led-veg-light-600", label: "LED VegLight 600", prerequisite: "lighting-coverage" },
  { blueprintId: "7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b", slug: "cool-air-split-3000", label: "CoolAir Split 3000", prerequisite: "climate-control" }
] as const;

export interface ZoneSetupLine {
  readonly blueprintId: string;
  readonly slug: string;
  readonly label: string;
  readonly prerequisite: string;
  readonly quantity: number;
  readonly unitCoverage_m2: number;
  readonly unitCostCc: number;
  readonly totalCostCc: number;
}

export interface ZoneSetupPlan {
  readonly lines: readonly ZoneSetupLine[];
  readonly totalCostCc: number;
  readonly isPriced: boolean;
}

function matchesDevice(entry: DevicePriceEntry, blueprintId: string, slug: string): boolean {
  return entry.deviceBlueprintId === blueprintId || entry.deviceSlug === slug;
}

/** Builds the smallest priced device bundle that covers the canonical demo zone. */
export function buildZoneSetupPlan(zone: ZoneReadModel, priceBook: PriceBookCatalog): ZoneSetupPlan {
  let isPriced = true;
  const lines = DEMO_SETUP_DEVICES.map((required) => {
    const price = priceBook.devices.find((entry) => matchesDevice(entry, required.blueprintId, required.slug));
    if (!price || price.coverageArea_m2 <= 0) isPriced = false;
    const unitCoverage = price?.coverageArea_m2 ?? 0;
    const installedCoverage = zone.devices.filter((device) => device.slug === required.slug).reduce((sum, device) => sum + device.coverageArea_m2, 0);
    const remainingCoverage = Math.max(0, zone.area_m2 - installedCoverage);
    const quantity = unitCoverage > 0 ? Math.ceil(remainingCoverage / unitCoverage) : 0;
    const unitCostCc = price?.capitalExpenditure ?? 0;
    return { ...required, quantity, unitCoverage_m2: unitCoverage, unitCostCc, totalCostCc: quantity * unitCostCc } satisfies ZoneSetupLine;
  });
  return { lines, totalCostCc: lines.reduce((sum, line) => sum + line.totalCostCc, 0), isPriced };
}
