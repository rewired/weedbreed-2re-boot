import type { ReactElement } from "react";
import { Leaf } from "lucide-react";

export function StrainsPage(): ReactElement {
  return (
    <section aria-label="Strain library" className="flex flex-1 flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Strains</p>
        <div className="flex items-center gap-3">
          <Leaf aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Genetics library placeholder</h2>
        </div>
        <p className="text-sm text-text-muted">
          Placeholder surface listing cultivated strain profiles, cannabinoid/terpene targets, and cultivation guidance until the
          dedicated module lands.
        </p>
      </header>
      <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6">
        <p className="text-sm text-text-muted">
          The strain management workspace will surface cultivar metadata, lifecycle milestones, and blueprint references. This
          placeholder keeps the navigation and shell layout aligned with SEC expectations while downstream read-model hydration is
          in flight.
        </p>
      </div>
    </section>
  );
}
