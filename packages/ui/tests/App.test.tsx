import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@ui/App";
import { workspaceCopy } from "@ui/design/tokens";

describe("App", () => {
  it("renders left rail navigation and dashboard skeleton", () => {
    render(<App />);

    const globalNavigation = screen.getByRole("navigation", { name: /global navigation/i });
    expect(globalNavigation).toBeInTheDocument();
    expect(
      within(globalNavigation).getByRole("link", {
        name: new RegExp(`^${workspaceCopy.leftRail.sections.company.label}`, "i")
      })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main", { name: /workspace content/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /operations dashboard/i })).toBeVisible();
  });
});
