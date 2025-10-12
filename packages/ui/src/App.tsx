import type { ReactElement } from "react";
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements
} from "react-router-dom";
import { LeftRail } from "@ui/components/layout/LeftRail";
import { WorkspaceLayout } from "@ui/layout/WorkspaceLayout";
import { workspaceTopLevelRoutes } from "@ui/lib/navigation";
import { DashboardRoute } from "@ui/routes/DashboardRoute";
import { WorkforceRoute } from "@ui/routes/WorkforceRoute";
import { ZoneDetailRoute } from "@ui/routes/ZoneDetailRoute";
import { createTelemetryBinder } from "@ui/transport";

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

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      element={
        <WorkspaceLayout
          leftRail={<LeftRail />}
          main={<Outlet />}
          footer={<p className="text-xs">Built with Node.js 22 · Deterministic engine scaffold (SEC v0.2.1)</p>}
        />
      }
    >
      <Route index element={<Navigate to={workspaceTopLevelRoutes.dashboard.path} replace />} />
      <Route path={workspaceTopLevelRoutes.dashboard.path} element={<DashboardRoute />} />
      <Route path="structures/:structureId/zones/:zoneId" element={<ZoneDetailRoute />} />
      <Route path={workspaceTopLevelRoutes.workforce.path} element={<WorkforceRoute />} />
      <Route path="*" element={<Navigate to={workspaceTopLevelRoutes.dashboard.path} replace />} />
    </Route>
  )
);

function App(): ReactElement {
  return <RouterProvider router={router} />;
}

export default App;
