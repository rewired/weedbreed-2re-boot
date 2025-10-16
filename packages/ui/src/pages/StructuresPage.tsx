import type { ReactElement } from "react";
import { Building2 } from "lucide-react";

export function StructuresPage(): ReactElement {
  return (
    <section aria-label="Structures overview" className="flex flex-1 flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Structures</p>
        <div className="flex items-center gap-3">
          <Building2 aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Facilities placeholder</h2>
        </div>
        <p className="text-sm text-text-muted">
          Placeholder surface summarising structure-level capacity, room distribution, and
          zoning readiness. This keeps the navigation shell aligned with SEC expectations
          while downstream read-model hydration remains in progress.
        </p>
      </header>
      <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6">
        <p className="text-sm text-text-muted">
          Future revisions will surface structure diagnostics, room occupancy, and
          quick links into grow zones. Until the read-model is wired, this placeholder
          ensures workspace navigation has a deterministic landing screen.
        </p>
      </div>
    </section>
  );
}
