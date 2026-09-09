import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const DEMO_ACTION_MODULES = [
  "../src/pages/structureHooks.ts",
  "../src/pages/RoomDetailPage.tsx",
  "../src/pages/roomDetailHooks.ts",
  "../src/pages/roomDetailControls.ts",
  "../src/pages/ZoneDetailPage.tsx",
  "../src/pages/zoneDetailHooks.ts",
  "../src/pages/zoneDetailHelpers.ts",
  "../src/pages/zoneDetailControls.ts",
  "../src/features/facility/ZoneSetupWizard.tsx",
  "../src/features/grow/ZoneSowingPanel.tsx",
  "../src/features/grow/ZoneIncidentPanel.tsx",
  "../src/features/grow/ZoneHarvestPanel.tsx",
  "../src/features/inventory/InventoryPanel.tsx",
  "../src/features/breeding/BreedingLab.tsx",
  "../src/features/breeding/BreedingComparisonTable.tsx",
  "../src/features/run-summary/RunSummaryPanel.tsx",
  "../src/features/session/SessionPersistencePanel.tsx"
] as const;

describe("demo primary action guardrail", () => {
  it.each(DEMO_ACTION_MODULES)("does not expose stub actions from %s", (relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");

    expect(source).not.toMatch(/\[stub\]/i);
  });
});
