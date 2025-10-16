import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeftRail } from "@ui/components/layout/LeftRail";
import { buildRoomPath, buildZonePath, workspaceStructures, workspaceTopLevelRoutes } from "@ui/lib/navigation";
import { workspaceCopy } from "@ui/design/tokens";

describe("LeftRail navigation", () => {
  const originalMatchMedia = window.matchMedia;

  function mockMatchMedia(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  }

  beforeEach(() => {
    mockMatchMedia(true);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function renderWithRouter(initialPath: string) {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<LeftRail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders top-level navigation links and highlights the active route", () => {
    renderWithRouter(workspaceTopLevelRoutes.company.path);

    const navigation = screen.getByLabelText("Global navigation");
    const mainNav = within(navigation);

    const companyLink = mainNav.getByRole("link", {
      name: new RegExp(`^${workspaceCopy.leftRail.sections.company.label}`, "i")
    });
    const structuresLink = mainNav.getByRole("link", {
      name: new RegExp(`^${workspaceCopy.leftRail.sections.structures.label}`, "i")
    });
    const hrLink = mainNav.getByRole("link", {
      name: new RegExp(`^${workspaceCopy.leftRail.sections.hr.label}`, "i")
    });
    const strainsLink = mainNav.getByRole("link", {
      name: new RegExp(`^${workspaceCopy.leftRail.sections.strains.label}`, "i")
    });

    expect(companyLink).toHaveAttribute("aria-current", "page");
    expect(structuresLink).not.toHaveAttribute("aria-current", "page");
    expect(hrLink).not.toHaveAttribute("aria-current", "page");
    expect(strainsLink).not.toHaveAttribute("aria-current", "page");
  });

  it("highlights the structures overview when visiting the structures landing route", () => {
    renderWithRouter(workspaceTopLevelRoutes.structures.path);

    const navigation = screen.getByLabelText("Global navigation");
    const structuresLink = within(navigation).getByRole("link", {
      name: new RegExp(`^${workspaceCopy.leftRail.sections.structures.label}`, "i")
    });

    expect(structuresLink).toHaveAttribute("aria-current", "page");
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

  it("expands the active structure when visiting a room detail route", () => {
    const targetStructure = workspaceStructures[0];
    const targetRoom = targetStructure.rooms[0];

    renderWithRouter(buildRoomPath(targetStructure.id, targetRoom.id));

    const structureToggle = screen.getByRole("button", { name: new RegExp(`^${targetStructure.name}`, "i") });
    expect(structureToggle).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses into a condensed mini-rail on narrow viewports and expands when toggled", async () => {
    mockMatchMedia(false);

    const { container } = renderWithRouter(workspaceTopLevelRoutes.company.path);

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    if (root) {
      expect(root).toHaveAttribute("data-collapsed", "true");
    }

    const condensedNav = screen.getByLabelText("Condensed navigation");
    expect(condensedNav).toBeVisible();

    const toggleButton = screen.getByRole("button", { name: workspaceCopy.leftRail.collapseToggle.expand });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    });

    await screen.findByRole("button", { name: workspaceCopy.leftRail.collapseToggle.collapse });

    if (root) {
      expect(root).toHaveAttribute("data-collapsed", "false");
    }

    expect(condensedNav).toHaveClass("hidden");
  });
});
