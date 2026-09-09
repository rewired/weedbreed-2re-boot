import type { ReactElement } from "react";

import type { RunSummaryReadModel, RunSummaryRole, RunSummarySaleStatus } from "@ui/state/runSummaryReadModels.types";

export interface RunSummaryPanelProps {
  readonly summary: RunSummaryReadModel;
}

const ROLE_LABELS: Record<RunSummaryRole, string> = {
  "seed-parent": "Samen-Elternteil",
  "pollen-parent": "Pollen-Elternteil",
  "selected-f1": "Eigene F1"
};

const SALE_LABELS: Record<RunSummarySaleStatus, string> = {
  "not-sold": "Nicht verkauft",
  "partially-sold": "Teilweise verkauft",
  sold: "Vollständig verkauft"
};

function cc(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)} CC`;
}

/** Separates measured cultivation results from genetic blueprint potential. */
export function RunSummaryPanel({ summary }: RunSummaryPanelProps): ReactElement {
  if (summary.status === "locked") {
    return (
      <section aria-labelledby="run-summary-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
        <h1 id="run-summary-heading" className="text-3xl font-semibold">Run Summary</h1>
        <p className="mt-3 text-text-muted">Wähle zuerst im Breeding Lab eine eigene F1 aus. Der Vergleich entsteht aus echten Ernten.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="run-summary-heading" className="space-y-6">
      <header>
        <p className="text-sm text-text-muted">Eltern gegen eigene F1</p>
        <h1 id="run-summary-heading" className="text-3xl font-semibold">Run Summary</h1>
        {summary.completed ? (
          <p role="status" className="mt-3 rounded-lg border border-accent-primary/50 bg-accent-primary/10 p-4">
            Ziel abgeschlossen: Deine F1 wurde real angebaut und geerntet. Abschluss in Sim-Stunde {summary.completedAtSimTimeHours}.
          </p>
        ) : (
          <p role="status" className="mt-3 rounded-lg border border-accent-warning/50 p-4 text-accent-warning">
            Ziel läuft: Ernte mindestens eine Pflanze deiner ausgewählten F1, um den Vergleich abzuschließen.
          </p>
        )}
      </header>

      <div className="overflow-x-auto rounded-xl border border-border-base">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">Reale Anbauergebnisse und Blueprint-Potenzial von Eltern und F1</caption>
          <thead className="bg-canvas-subtle text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Sorte</th>
              <th scope="col" className="px-4 py-3">Reale Ernte</th>
              <th scope="col" className="px-4 py-3">Reale Qualität</th>
              <th scope="col" className="px-4 py-3">Reale Zyklusdauer</th>
              <th scope="col" className="px-4 py-3">Realisierter Direktbeitrag</th>
              <th scope="col" className="px-4 py-3">Blueprint-Ertragspotenzial</th>
              <th scope="col" className="px-4 py-3">Blueprint-Zyklusdauer</th>
              <th scope="col" className="px-4 py-3">Blueprint-Robustheit</th>
            </tr>
          </thead>
          <tbody>
            {summary.entries.map((entry) => (
              <tr key={entry.role} className="border-t border-border-base bg-canvas-raised align-top">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {entry.name}<span className="mt-1 block text-xs font-normal text-text-muted">{ROLE_LABELS[entry.role]}</span>
                </th>
                {entry.actual ? (
                  <>
                    <td className="px-4 py-3">{entry.actual.harvestedFreshWeightG.toFixed(1)} g <span className="block text-xs text-text-muted">{entry.actual.harvestedPlantCount} Pflanzen</span></td>
                    <td className="px-4 py-3">{(entry.actual.averageQuality01 * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">{entry.actual.averageCycleDurationHours.toFixed(0)} h</td>
                    <td className="px-4 py-3">{cc(entry.actual.realizedDirectMarginCc)} <span className="block text-xs text-text-muted">{SALE_LABELS[entry.actual.saleStatus]} · Sales minus Seeds, ohne gemeinsame OpEx</span></td>
                  </>
                ) : (
                  <td colSpan={4} className="px-4 py-3 text-text-muted">Noch keine reale Ernte</td>
                )}
                <td className="border-l border-border-base px-4 py-3">{entry.blueprintPotential.yieldPotentialGPerPlant.toFixed(1)} g/Pflanze</td>
                <td className="px-4 py-3">{entry.blueprintPotential.cycleDurationDays.toFixed(0)} Tage</td>
                <td className="px-4 py-3">{(entry.blueprintPotential.resilience01 * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="shared-cost-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
        <h2 id="shared-cost-heading" className="text-lg font-semibold">Gemeinsame Betriebskosten</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-text-muted">Nicht Sorten zugeordnete OpEx</dt><dd>{cc(summary.unallocatedOperatingExpenseCc)}</dd></div>
          <div><dt className="text-sm text-text-muted">Gesamter Zyklus-Deckungsbeitrag</dt><dd>{cc(summary.overallCycleContributionMarginCc)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-text-muted">Gemeinsame Strom-, Wasser- und Betriebskosten werden nicht künstlich auf einzelne Sorten verteilt.</p>
      </section>
    </section>
  );
}
