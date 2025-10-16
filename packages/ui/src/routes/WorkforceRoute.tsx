import type { ReactElement } from "react";
import { WorkforcePage } from "@ui/pages/WorkforcePage";
import { useIntentClient } from "@ui/transport";

export function WorkforceRoute(): ReactElement {
  const intentClient = useIntentClient();
  return <WorkforcePage intentClient={intentClient} />;
}
