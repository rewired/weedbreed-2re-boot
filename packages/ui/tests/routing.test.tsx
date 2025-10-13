import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { workspaceRoutes } from "@ui/routes/workspaceRoutes";

describe("workspaceRoutes", () => {
  it("renders the dashboard when navigating to the root path", () => {
    const router = createMemoryRouter(workspaceRoutes, { initialEntries: ["/"] });

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /operations dashboard/i })
    ).toBeVisible();
  });
});
