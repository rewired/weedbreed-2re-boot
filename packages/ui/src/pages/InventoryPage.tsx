import type { ReactElement } from "react";

import { InventoryPanel } from "@ui/features/inventory/InventoryPanel";
import { useReadModelStore } from "@ui/state/readModels";
import { useIntentClient } from "@ui/transport";

/** Inventory and authoritative partial-sale surface. */
export function InventoryPage(): ReactElement {
  const inventory = useReadModelStore((state) => state.snapshot.inventory);
  const economy = useReadModelStore((state) => state.snapshot.economy);
  const intentClient = useIntentClient();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-text-muted">Harvest storage</p>
        <h1 className="text-3xl font-semibold">Inventar</h1>
      </header>
      <InventoryPanel inventory={inventory ?? { lots: [], totalFreshWeightKg: 0 }} economy={economy} intentClient={intentClient} />
    </div>
  );
}
