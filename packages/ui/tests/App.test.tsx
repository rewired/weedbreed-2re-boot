import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "@ui/App";

describe("App", () => {
  it("renders left rail navigation and workspace placeholder", () => {
    render(<App />);

    expect(
      screen.getByRole("navigation", { name: /workspace sections/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("main", { name: /workspace content/i })).toBeInTheDocument();
    expect(screen.getByText(/workspace bootstrap/i)).toBeVisible();
  });
});
