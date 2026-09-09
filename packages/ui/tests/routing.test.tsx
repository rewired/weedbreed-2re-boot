import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { workspaceRoutes } from "@ui/routes/workspaceRoutes";
import { buildZonePath, workspaceStructures } from "@ui/lib/navigation";
import { resetReadModelStore } from "@ui/state/readModels";

beforeEach(() => {
  resetReadModelStore();
});

describe("workspaceRoutes", () => {
  it("renders the dashboard when navigating to the root path", () => {
    const router = createMemoryRouter(workspaceRoutes, { initialEntries: ["/"] });

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /operations dashboard/i })
    ).toBeVisible();
  });

  it("keeps the visible demo journey connected from Grow through Inventory and Breeding to Summary", async () => {
    const structure = workspaceStructures.find((entry) => entry.zones.length > 0);
    const zone = structure?.zones[0];
    if (!structure || !zone) throw new Error("The demo requires a visible Grow zone.");
    const router = createMemoryRouter(workspaceRoutes, {
      initialEntries: [buildZonePath(structure.id, zone.id)]
    });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("region", { name: new RegExp(`Zone detail for ${zone.name}`, "i") })).toBeVisible();
    const navigation = within(screen.getByLabelText("Global navigation"));

    fireEvent.click(navigation.getByRole("link", { name: /^Inventar/i }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Inventar" })).toBeVisible());
    fireEvent.click(navigation.getByRole("link", { name: /^Breeding/i }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Breeding Lab" })).toBeVisible());
    fireEvent.click(navigation.getByRole("link", { name: /^Run Summary/i }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Run Summary" })).toBeVisible());
  });
});
