import type { ReactElement } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useStructureReadModels } from "@ui/lib/readModelHooks";

export function StructuresPage(): ReactElement {
  const structures = useStructureReadModels();

  return (
    <section aria-label="Structures overview" className="flex flex-1 flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Structures</p>
        <div className="flex items-center gap-3">
          <Building2 aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Facilities</h2>
        </div>
        <p className="text-sm text-text-muted">
          Select a structure to inspect capacity, rooms, and workforce summaries. Entries hydrate from the deterministic
          read-model snapshot until live transport wiring lands.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {structures.map((structure) => (
          <article
            key={structure.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-6"
          >
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-text-primary">{structure.name}</h3>
              <p className="text-sm text-text-muted">{structure.location}</p>
              <p className="text-sm text-text-primary">
                {structure.capacity.areaUsed_m2} m² used · {structure.capacity.areaFree_m2} m² free
              </p>
              <p className="text-xs text-text-muted">
                Rooms: {structure.rooms.length} · Zones: {structure.rooms.reduce((sum, room) => sum + room.zones.length, 0)}
              </p>
            </div>
            <Link
              to={`/structures/${structure.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-accent-primary transition hover:underline"
            >
              View structure
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
