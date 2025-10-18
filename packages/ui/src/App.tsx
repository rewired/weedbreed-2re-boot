import type { ReactElement } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { IntentClientProvider, createIntentClient, createTelemetryBinder, createReadModelClient } from "@ui/transport";
import { workspaceRoutes } from "@ui/routes/workspaceRoutes";
import { configureReadModelClient } from "@ui/state/readModels";

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

const telemetryBinder = runtimeBaseUrl
  ? createTelemetryBinder({ baseUrl: runtimeBaseUrl })
  : null;

const readModelClient = runtimeBaseUrl
  ? createReadModelClient({ baseUrl: runtimeBaseUrl })
  : null;

const intentClient = runtimeBaseUrl ? createIntentClient({ baseUrl: runtimeBaseUrl }) : null;

if (telemetryBinder) {
  telemetryBinder.connect();
} else {
  console.warn("Telemetry binder initialisation skipped: transport base URL was not configured.");
}

if (readModelClient) {
  configureReadModelClient(readModelClient);
} else {
  console.warn("Read-model client initialisation skipped: transport base URL was not configured.");
}

const router = createBrowserRouter(workspaceRoutes);

function App(): ReactElement {
  return (
    <IntentClientProvider client={intentClient}>
      <RouterProvider router={router} />
    </IntentClientProvider>
  );
}

export default App;
