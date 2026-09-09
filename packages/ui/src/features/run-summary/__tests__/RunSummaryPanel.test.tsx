import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunSummaryPanel } from "@ui/features/run-summary/RunSummaryPanel";
import type { RunSummaryReadModel } from "@ui/state/runSummaryReadModels.types";

const entries: RunSummaryReadModel["entries"] = [
  {
    role: "seed-parent",
    strainId: "parent-a",
    name: "Northern Lights",
    actual: {
      harvestedPlantCount: 2,
      harvestedFreshWeightG: 410,
      averageQuality01: 0.91,
      averageCycleDurationHours: 2_100,
      realizedDirectMarginCc: 180,
      saleStatus: "partially-sold"
    },
    blueprintPotential: { yieldPotentialGPerPlant: 35, cycleDurationDays: 92, resilience01: 0.7 }
  },
  {
    role: "pollen-parent",
    strainId: "parent-b",
    name: "Sour Diesel",
    actual: {
      harvestedPlantCount: 2,
      harvestedFreshWeightG: 500,
      averageQuality01: 0.88,
      averageCycleDurationHours: 2_500,
      realizedDirectMarginCc: -30,
      saleStatus: "not-sold"
    },
    blueprintPotential: { yieldPotentialGPerPlant: 55, cycleDurationDays: 128, resilience01: 0.6 }
  },
  {
    role: "selected-f1",
    strainId: "f1",
    name: "Ramp One",
    actual: null,
    blueprintPotential: { yieldPotentialGPerPlant: 48, cycleDurationDays: 105, resilience01: 0.75 }
  }
];

const inProgress: RunSummaryReadModel = {
  status: "in-progress",
  completed: false,
  completedAtSimTimeHours: null,
  breedingRunId: "run-1",
  unallocatedOperatingExpenseCc: 12_000,
  overallCycleContributionMarginCc: -11_850,
  entries
};

describe("RunSummaryPanel", () => {
  it("keeps the goal locked until a custom F1 has been selected", () => {
    render(<RunSummaryPanel summary={{ ...inProgress, status: "locked", breedingRunId: null, entries: [] }} />);
    expect(screen.getByRole("heading", { name: "Run Summary" })).toBeVisible();
    expect(screen.getByText(/Wähle zuerst im Breeding Lab/)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("separates actual results from blueprint potential while the F1 is unharvested", () => {
    render(<RunSummaryPanel summary={inProgress} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ziel läuft");
    const table = screen.getByRole("table", { name: "Reale Anbauergebnisse und Blueprint-Potenzial von Eltern und F1" });
    for (const heading of ["Reale Ernte", "Reale Qualität", "Reale Zyklusdauer", "Realisierter Direktbeitrag", "Blueprint-Ertragspotenzial", "Blueprint-Zyklusdauer", "Blueprint-Robustheit"]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeVisible();
    }
    const f1Row = within(table).getByRole("row", { name: /Ramp One/ });
    expect(within(f1Row).getByText("Noch keine reale Ernte")).toBeVisible();
    expect(within(f1Row).getByText("48.0 g/Pflanze")).toBeVisible();
    expect(screen.getByText("12000.00 CC")).toBeVisible();
    expect(screen.getByText("-11850.00 CC")).toBeVisible();
    expect(screen.getByText(/nicht künstlich auf einzelne Sorten verteilt/)).toBeVisible();
  });

  it("completes only with projected F1 harvest evidence", () => {
    const f1Actual = {
      harvestedPlantCount: 1,
      harvestedFreshWeightG: 240,
      averageQuality01: 0.94,
      averageCycleDurationHours: 2_300,
      realizedDirectMarginCc: 0,
      saleStatus: "not-sold" as const
    };
    render(<RunSummaryPanel summary={{ ...inProgress, status: "completed", completed: true, completedAtSimTimeHours: 5_000, entries: entries.map((entry) => entry.role === "selected-f1" ? { ...entry, actual: f1Actual } : entry) }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ziel abgeschlossen");
    const f1Row = screen.getByRole("row", { name: /Ramp One/ });
    expect(within(f1Row).getByText("240.0 g")).toBeVisible();
    expect(within(f1Row).getByText("94.0%")).toBeVisible();
    expect(within(f1Row).getByText("2300 h")).toBeVisible();
    expect(within(f1Row).getByText("Nicht verkauft · Sales minus Seeds, ohne gemeinsame OpEx")).toBeVisible();
  });
});
