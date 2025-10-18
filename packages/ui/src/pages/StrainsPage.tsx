import { useMemo, type ReactElement } from "react";
import { Leaf } from "lucide-react";

import { formatCurrency, useShellLocale } from "@ui/lib/locale";
import { useReadModelStore } from "@ui/state/readModels";
import type { CompatibilityStatus } from "@ui/state/readModels.types";

interface CompatibilityEntry {
  readonly id: string;
  readonly label: string;
  readonly status: CompatibilityStatus;
  readonly statusLabel: string;
  readonly statusClass: string;
}

interface StrainCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly cultivation: readonly CompatibilityEntry[];
  readonly irrigation: readonly CompatibilityEntry[];
}

const STATUS_LABELS: Record<CompatibilityStatus, string> = {
  ok: "OK",
  warn: "Warn",
  block: "Block"
};

const STATUS_STYLES: Record<CompatibilityStatus, string> = {
  ok: "border-accent-primary text-accent-primary",
  warn: "border-accent-warning text-accent-warning",
  block: "border-destructive text-destructive"
};

export function StrainsPage(): ReactElement {
  const locale = useShellLocale();
  const { priceBook, compatibility } = useReadModelStore((state) => ({
    priceBook: state.snapshot.priceBook,
    compatibility: state.snapshot.compatibility
  }));

  const strains = useMemo<StrainCatalogEntry[]>(() => {
    const seedlingPriceByStrain = new Map(
      priceBook.seedlings.map((entry) => [entry.strainId, entry.pricePerUnit])
    );

    return Object.entries(compatibility.strainToCultivation)
      .map(([strainId, entry]) => {
        const cultivation = mapCompatibilityEntries(entry.cultivation);
        const irrigation = mapCompatibilityEntries(entry.irrigation);
        const price = seedlingPriceByStrain.get(strainId) ?? null;

        return {
          id: strainId,
          name: formatStrainName(strainId),
          priceLabel: price ? `${formatCurrency(price, locale)}/seedling` : "Price unavailable",
          cultivation,
          irrigation
        } satisfies StrainCatalogEntry;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [priceBook.seedlings, compatibility.strainToCultivation, locale]);

  return (
    <section aria-label="Strain library" className="flex flex-1 flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Strains</p>
        <div className="flex items-center gap-3">
          <Leaf aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Cultivar compatibility catalog</h2>
        </div>
        <p className="text-sm text-text-muted">
          Hydrated from the strain compatibility read model. Entries list compatible cultivation and
          irrigation methods plus deterministic seedling pricing.
        </p>
      </header>

      <ul className="grid gap-4" aria-label="Strain catalog">
        {strains.map((strain) => (
          <li
            key={strain.id}
            className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-2xl font-semibold text-text-primary">{strain.name}</h3>
              <span className="rounded-full border border-border-base px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-text-primary">
                {strain.priceLabel}
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CompatibilityColumn
                heading="Cultivation methods"
                ariaLabel={`${strain.name} cultivation compatibility`}
                entries={strain.cultivation}
              />
              <CompatibilityColumn
                heading="Irrigation methods"
                ariaLabel={`${strain.name} irrigation compatibility`}
                entries={strain.irrigation}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function mapCompatibilityEntries(
  compatibilityMap: Readonly<Record<string, CompatibilityStatus>>
): CompatibilityEntry[] {
  return Object.entries(compatibilityMap)
    .map(([id, status]) => ({
      id,
      label: formatSlugLabel(id),
      status,
      statusLabel: STATUS_LABELS[status],
      statusClass: STATUS_STYLES[status]
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function formatStrainName(strainId: string): string {
  return formatSlugLabel(strainId);
}

function formatSlugLabel(slug: string): string {
  const cleaned = slug.replace(/^(cm-|ir-|strain-)/, "");
  return cleaned
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

interface CompatibilityColumnProps {
  readonly heading: string;
  readonly ariaLabel: string;
  readonly entries: readonly CompatibilityEntry[];
}

function CompatibilityColumn({
  heading,
  ariaLabel,
  entries
}: CompatibilityColumnProps): ReactElement {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-text-primary">{heading}</h4>
      <ul className="grid gap-2" aria-label={ariaLabel}>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between rounded-lg border border-border-subtle bg-canvas-base/70 px-3 py-2 text-sm text-text-primary"
          >
            <span>{entry.label}</span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${entry.statusClass}`}
            >
              {entry.statusLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
