import type { ReactElement } from "react";
import { WorkforcePage } from "@ui/pages/WorkforcePage";
import { createIntentClient, type IntentClient } from "@ui/transport";

const runtimeBaseUrl = (() => {
  const configured = import.meta.env.VITE_TRANSPORT_BASE_URL as string | undefined;

  if (configured && configured.length > 0) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return undefined;
})();

const intentClient: IntentClient | null = runtimeBaseUrl
  ? createIntentClient({ baseUrl: runtimeBaseUrl })
  : null;

export function WorkforceRoute(): ReactElement {
  return <WorkforcePage intentClient={intentClient} />;
}
