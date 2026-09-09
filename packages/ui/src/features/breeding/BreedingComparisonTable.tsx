import type { ReactElement } from "react";

import type {
  BreedingCandidateReadModel,
  BreedingRunReadModel,
  BreedingTraitsReadModel,
  QualifiedBreedingParentReadModel
} from "@ui/state/breedingReadModels.types";

interface ComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly kind: "Elternteil" | "F1-Kandidat";
  readonly traits: BreedingTraitsReadModel;
  readonly delta: BreedingTraitsReadModel | null;
}

export interface BreedingComparisonTableProps {
  readonly run: BreedingRunReadModel;
  readonly selectedCandidateId: string;
  readonly onCandidateSelect: (candidateId: string) => void;
  readonly disabled?: boolean;
}

function signed(value: number, digits = 1): string {
  const formatted = Math.abs(value).toFixed(digits);
  if (value === 0) return `±${formatted}`;
  return `${value > 0 ? "+" : "−"}${formatted}`;
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parentRow(parent: QualifiedBreedingParentReadModel): ComparisonRow {
  return { id: parent.strainId, label: parent.name, kind: "Elternteil", traits: parent.traits, delta: null };
}

function candidateRow(candidate: BreedingCandidateReadModel): ComparisonRow {
  return {
    id: candidate.candidateId,
    label: candidate.name,
    kind: "F1-Kandidat",
    traits: candidate.traits,
    delta: candidate.deltaFromParentMean
  };
}

/** Shows parents and candidates with exactly the same authoritative trait columns. */
export function BreedingComparisonTable({ run, selectedCandidateId, onCandidateSelect, disabled = false }: BreedingComparisonTableProps): ReactElement {
  const rows: ComparisonRow[] = [
    ...run.parents.map(parentRow),
    ...run.candidates.map(candidateRow)
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border-base">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">Vergleich der Eltern und F1-Kandidaten</caption>
        <thead className="bg-canvas-subtle text-text-muted">
          <tr>
            <th scope="col" className="px-4 py-3">Auswahl</th>
            <th scope="col" className="px-4 py-3">Sorte</th>
            <th scope="col" className="px-4 py-3">Ertragspotenzial</th>
            <th scope="col" className="px-4 py-3">Zyklusdauer</th>
            <th scope="col" className="px-4 py-3">Robustheit</th>
            <th scope="col" className="px-4 py-3">THC / CBD</th>
            <th scope="col" className="px-4 py-3">Temperaturband</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isCandidate = row.kind === "F1-Kandidat";
            return (
              <tr key={`${row.kind}-${row.id}`} className="border-t border-border-base bg-canvas-raised align-top">
                <td className="px-4 py-3">
                  {isCandidate ? (
                    <input
                      type="radio"
                      name="breeding-candidate"
                      aria-label={`${row.label} auswählen`}
                      value={row.id}
                      checked={selectedCandidateId === row.id}
                      disabled={disabled}
                      onChange={() => onCandidateSelect(row.id)}
                    />
                  ) : <span aria-hidden="true">—</span>}
                </td>
                <th scope="row" className="px-4 py-3 font-semibold text-text-primary">
                  {row.label}<span className="mt-1 block text-xs font-normal text-text-muted">{row.kind}</span>
                </th>
                <TraitCell value={`${row.traits.yieldPotentialGPerPlant.toFixed(1)} g/Pflanze`} delta={row.delta ? `${signed(row.delta.yieldPotentialGPerPlant)} g` : null} />
                <TraitCell value={`${row.traits.cycleDurationDays.toFixed(0)} Tage`} delta={row.delta ? `${signed(row.delta.cycleDurationDays, 0)} Tage` : null} />
                <TraitCell value={percentage(row.traits.resilience01)} delta={row.delta ? signed(row.delta.resilience01 * 100) + " pp" : null} />
                <TraitCell value={`${percentage(row.traits.thc01)} / ${percentage(row.traits.cbd01)}`} delta={row.delta ? `${signed(row.delta.thc01 * 100)} / ${signed(row.delta.cbd01 * 100)} pp` : null} />
                <TraitCell value={`${row.traits.temperatureBandC.min.toFixed(1)}–${row.traits.temperatureBandC.max.toFixed(1)} °C`} delta={row.delta ? `${signed(row.delta.temperatureBandC.min)} / ${signed(row.delta.temperatureBandC.max)} °C` : null} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TraitCell({ value, delta }: { readonly value: string; readonly delta: string | null }): ReactElement {
  return (
    <td className="px-4 py-3 text-text-primary">
      <span>{value}</span>
      {delta ? <span className="mt-1 block text-xs text-accent-muted">zum Elternmittel {delta}</span> : null}
    </td>
  );
}
