import type { ReactElement } from "react";

import { RunSummaryPanel } from "@ui/features/run-summary/RunSummaryPanel";
import { useReadModelStore } from "@ui/state/readModels";

export function RunSummaryPage(): ReactElement {
  const summary = useReadModelStore((state) => state.snapshot.runSummary);
  return <RunSummaryPanel summary={summary} />;
}
