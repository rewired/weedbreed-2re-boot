import type { ReactElement } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { createTelemetryBinder } from "@ui/transport";
import { workspaceRoutes } from "@ui/routes/workspaceRoutes";

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

if (telemetryBinder) {
  telemetryBinder.connect();
} else {
  console.warn("Telemetry binder initialisation skipped: transport base URL was not configured.");
}

const router = createBrowserRouter(workspaceRoutes);

function App(): ReactElement {
  return <RouterProvider router={router} />;
}

export default App;
