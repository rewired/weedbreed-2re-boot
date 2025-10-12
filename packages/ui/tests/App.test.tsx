import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@ui/App";

describe("App", () => {
  it("renders left rail navigation and dashboard skeleton", () => {
    render(<App />);

    const globalNavigation = screen.getByRole("navigation", { name: /global navigation/i });
    expect(globalNavigation).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i, exact: false })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main", { name: /workspace content/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /operations dashboard/i })).toBeVisible();
  });
});
