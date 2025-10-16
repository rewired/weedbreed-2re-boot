import type { ReactElement } from "react";
import { Building2, ShieldAlert } from "lucide-react";
import { StructureCapacityGrid } from "@ui/components/structures/StructureCapacityGrid";
import { StructureRoomsGrid } from "@ui/components/structures/StructureRoomsGrid";
import { StructureWorkforceSnapshot } from "@ui/components/structures/StructureWorkforceSnapshot";
import "@ui/styles/structures.css";
import { useStructureOverview } from "@ui/pages/structureHooks";
import { InlineRenameField } from "@ui/components/common/InlineRenameField";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";
import { useIntentClient } from "@ui/transport";

export interface StructurePageProps {
  readonly structureId: string;
}

export function StructurePage({ structureId }: StructurePageProps): ReactElement {
  const overview = useStructureOverview(structureId);
  const { header, capacityTiles, rooms, workforce, coverageWarnings } = overview;
  const intentClient = useIntentClient();

  const renameDisabledReason = intentClient
    ? undefined
    : "Intent transport unavailable.";

  return (
    <section aria-label={`Structure overview for ${header.name}`} className="flex flex-1 flex-col gap-6">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Structure</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Building2 aria-hidden="true" className="size-6 text-accent-primary" />
            <InlineRenameField
              name={header.name}
              label="Structure name"
              renameLabel="Rename"
              disabledReason={renameDisabledReason}
              onSubmit={async (nextName) => {
                if (!intentClient) {
                  throw new Error("Intent transport unavailable.");
                }

                await submitIntentOrThrow(intentClient, {
                  type: "intent.structure.rename.v1",
                  structureId: header.id,
                  name: nextName
                });
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Location</p>
            <p className="text-lg font-semibold text-text-primary">{header.location}</p>
          </div>
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Floor area</p>
            <p className="text-lg font-semibold text-text-primary">{header.areaUsedLabel}</p>
            <p className="text-xs text-text-muted">Free: {header.areaFreeLabel}</p>
          </div>
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Volume</p>
            <p className="text-lg font-semibold text-text-primary">{header.volumeUsedLabel}</p>
            <p className="text-xs text-text-muted">Free: {header.volumeFreeLabel}</p>
          </div>
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Rooms · Zones</p>
            <p className="text-lg font-semibold text-text-primary">
              {header.roomsCount} · {header.zonesCount}
            </p>
            <p className="text-xs text-text-muted">
              Avg zone health: {header.averageHealthPercent !== null ? `${header.averageHealthPercent.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Electricity tariff</p>
            <p className="text-lg font-semibold text-text-primary">
              {header.tariffs.electricityPricePerKwh.toFixed(2)} per kWh
            </p>
            <p className="text-xs text-text-muted">Resolved at simulation start (SEC §3.6)</p>
          </div>
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Water tariff</p>
            <p className="text-lg font-semibold text-text-primary">
              {header.tariffs.waterPricePerM3.toFixed(1)} per m³
            </p>
            <p className="text-xs text-text-muted">Immutable for scenario runtime</p>
          </div>
          <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Pest & inspections</p>
            <p className="text-lg font-semibold text-text-primary">
              {header.pestActiveIssues} active · {header.pestDueInspections} inspections due
            </p>
            <p className="text-xs text-text-muted">Upcoming treatments: {header.pestUpcomingTreatments}</p>
          </div>
        </div>
      </header>

      {coverageWarnings.length > 0 ? (
        <div className="rounded-xl border border-accent-critical/60 bg-accent-critical/10 p-4">
          <div className="flex items-center gap-2 text-accent-critical">
            <ShieldAlert aria-hidden="true" className="size-5" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">Structure warnings</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-accent-critical">
            {coverageWarnings.map((warning) => (
              <li key={warning.id}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <StructureCapacityGrid tiles={capacityTiles} />

      <StructureRoomsGrid rooms={rooms} />

      <StructureWorkforceSnapshot {...workforce} />
    </section>
  );
}

