import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LeftRail } from "@ui/components/layout/LeftRail";
import { buildZonePath, workspaceStructures, workspaceTopLevelRoutes } from "@ui/lib/navigation";

describe("LeftRail navigation", () => {
  function renderWithRouter(initialPath: string): void {
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<LeftRail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders top-level navigation links and highlights the active route", () => {
    renderWithRouter(workspaceTopLevelRoutes.dashboard.path);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    const workforceLink = screen.getByRole("link", { name: /workforce kpis/i });

    expect(dashboardLink).toHaveAttribute("aria-current", "page");
    expect(workforceLink).not.toHaveAttribute("aria-current", "page");
  });

  it("expands the active structure and marks the selected zone", () => {
    const targetStructure = workspaceStructures[1];
    const targetZone = targetStructure.zones[1];

    renderWithRouter(buildZonePath(targetStructure.id, targetZone.id));

    const structureToggle = screen.getByRole("button", { name: new RegExp(`^${targetStructure.name}`, "i") });
    expect(structureToggle).toHaveAttribute("aria-expanded", "true");

    const zoneLink = screen.getByRole("link", { name: new RegExp(targetZone.name, "i") });
    expect(zoneLink).toHaveAttribute("aria-current", "page");
  });
});
