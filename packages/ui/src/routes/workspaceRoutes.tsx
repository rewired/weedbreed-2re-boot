import { Navigate, Outlet, Route, createRoutesFromElements } from "react-router-dom";
import { LeftRail } from "@ui/components/layout/LeftRail";
import { SimControlBar } from "@ui/components/layout/SimControlBar";
import { WorkspaceLayout } from "@ui/layout/WorkspaceLayout";
import { workspaceTopLevelRoutes } from "@ui/lib/navigation";
import { DashboardRoute } from "@ui/routes/DashboardRoute";
import { WorkforceRoute } from "@ui/routes/WorkforceRoute";
import { ZoneDetailRoute } from "@ui/routes/ZoneDetailRoute";
import { StrainsRoute } from "@ui/routes/StrainsRoute";
import { StructuresRoute } from "@ui/routes/StructuresRoute";
import { StructureRoute } from "@ui/routes/StructureRoute";
import { RoomDetailRoute } from "@ui/routes/RoomDetailRoute";
import { InventoryRoute } from "@ui/routes/InventoryRoute";
import { BreedingRoute } from "@ui/routes/BreedingRoute";
import { RunSummaryRoute } from "@ui/routes/RunSummaryRoute";

export const workspaceRoutes = createRoutesFromElements(
  <Route
    path="/"
    element={
      <WorkspaceLayout
        leftRail={<LeftRail />}
        main={<Outlet />}
        simControlBar={<SimControlBar />}
        footer={
          <p className="text-xs">
            Built with Node.js 22 · Deterministic engine scaffold (SEC v0.2.1)
          </p>
        }
      />
    }
  >
    <Route index element={<Navigate to={workspaceTopLevelRoutes.company.path} replace />} />
    <Route path={workspaceTopLevelRoutes.company.path} element={<DashboardRoute />} />
    <Route path={workspaceTopLevelRoutes.structures.path} element={<StructuresRoute />} />
    <Route path="structures/:structureId" element={<StructureRoute />} />
    <Route path="structures/:structureId/rooms/:roomId" element={<RoomDetailRoute />} />
    <Route path="structures/:structureId/zones/:zoneId" element={<ZoneDetailRoute />} />
    <Route path={workspaceTopLevelRoutes.hr.path} element={<WorkforceRoute />} />
    <Route path={workspaceTopLevelRoutes.strains.path} element={<StrainsRoute />} />
    <Route path={workspaceTopLevelRoutes.inventory.path} element={<InventoryRoute />} />
    <Route path={workspaceTopLevelRoutes.breeding.path} element={<BreedingRoute />} />
    <Route path={workspaceTopLevelRoutes.runSummary.path} element={<RunSummaryRoute />} />
    <Route path="*" element={<Navigate to={workspaceTopLevelRoutes.company.path} replace />} />
  </Route>
);
