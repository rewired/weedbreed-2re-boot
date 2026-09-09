import type { ReactElement } from "react";

import { BreedingLab } from "@ui/features/breeding/BreedingLab";
import { useReadModelStore } from "@ui/state/readModels";
import { useIntentClient } from "@ui/transport";

/** Breeding journey page backed exclusively by the facade read model. */
export function BreedingPage(): ReactElement {
  const breeding = useReadModelStore((state) => state.snapshot.breeding);
  const intentClient = useIntentClient();
  return <BreedingLab breeding={breeding} intentClient={intentClient} />;
}
