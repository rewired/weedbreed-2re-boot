import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StrainsPage } from "@ui/pages/StrainsPage";

describe("StrainsPage", () => {
  it("renders strain catalog entries from the read model", () => {
    render(<StrainsPage />);

    expect(
      screen.getByRole("heading", { name: /Cultivar compatibility catalog/i })
    ).toBeInTheDocument();

    const catalogList = screen.getByRole("list", { name: /Strain catalog/i });
    const strainHeadings = within(catalogList).getAllByRole("heading", { level: 3 });
    expect(strainHeadings).toHaveLength(2);

    const northernHeading = strainHeadings.find((heading) =>
      heading.textContent?.includes("Northern Lights")
    );
    if (!northernHeading) {
      throw new Error("Expected Northern Lights heading to be present");
    }
    const northernLights = northernHeading.closest("li");
    if (!(northernLights instanceof HTMLElement)) {
      throw new Error("Expected Northern Lights card to render as a list item");
    }
    expect(within(northernLights).getByText("Northern Lights")).toBeInTheDocument();
    expect(within(northernLights).getByText(/€4\.80\/seedling/i)).toBeInTheDocument();

    const northernCultivation = within(northernLights).getByRole("list", {
      name: /Northern Lights cultivation compatibility/i
    });
    expect(within(northernCultivation).getByText("Sea Of Green")).toBeInTheDocument();
    expect(within(northernCultivation).getByText("Screen Of Green")).toBeInTheDocument();
    expect(within(northernCultivation).getAllByText(/OK|Warn/)).toHaveLength(2);

    const northernIrrigation = within(northernLights).getByRole("list", {
      name: /Northern Lights irrigation compatibility/i
    });
    expect(within(northernIrrigation).getByText("Drip Inline")).toBeInTheDocument();
    expect(within(northernIrrigation).getByText("Top Feed")).toBeInTheDocument();

    const superHeading = strainHeadings.find((heading) =>
      heading.textContent?.includes("Super Lemon Haze")
    );
    if (!superHeading) {
      throw new Error("Expected Super Lemon Haze heading to be present");
    }
    const superLemon = superHeading.closest("li");
    if (!(superLemon instanceof HTMLElement)) {
      throw new Error("Expected Super Lemon Haze card to render as a list item");
    }
    expect(within(superLemon).getByText("Super Lemon Haze")).toBeInTheDocument();
    expect(within(superLemon).getByText(/€5\.20\/seedling/i)).toBeInTheDocument();
  });
});
