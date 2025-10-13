import { Navigate, Outlet, Route, createRoutesFromElements } from "react-router-dom";
import { LeftRail } from "@ui/components/layout/LeftRail";
import { WorkspaceLayout } from "@ui/layout/WorkspaceLayout";
import { workspaceTopLevelRoutes } from "@ui/lib/navigation";
import { DashboardRoute } from "@ui/routes/DashboardRoute";
import { WorkforceRoute } from "@ui/routes/WorkforceRoute";
import { ZoneDetailRoute } from "@ui/routes/ZoneDetailRoute";

export const workspaceRoutes = createRoutesFromElements(
  <Route
    path="/"
    element={
      <WorkspaceLayout
        leftRail={<LeftRail />}
        main={<Outlet />}
        footer={
          <p className="text-xs">
            Built with Node.js 22 · Deterministic engine scaffold (SEC v0.2.1)
          </p>
        }
      />
    }
  >
    <Route index element={<Navigate to={workspaceTopLevelRoutes.dashboard.path} replace />} />
    <Route path={workspaceTopLevelRoutes.dashboard.path} element={<DashboardRoute />} />
    <Route path="structures/:structureId/zones/:zoneId" element={<ZoneDetailRoute />} />
    <Route path={workspaceTopLevelRoutes.workforce.path} element={<WorkforceRoute />} />
    <Route path="*" element={<Navigate to={workspaceTopLevelRoutes.dashboard.path} replace />} />
  </Route>
);
