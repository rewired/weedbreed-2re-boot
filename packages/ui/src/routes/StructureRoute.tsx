import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";
import { StructurePage } from "@ui/pages/StructurePage";
import { useStructureReadModel } from "@ui/lib/readModelHooks";

export function StructureRoute(): ReactElement {
  const { structureId } = useParams();
  const structure = useStructureReadModel(structureId);

  if (!structure || !structureId) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-4 text-center lg:text-left">
        <AlertTriangle className="mx-auto size-10 text-accent-muted lg:mx-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text-primary">Structure not found</h2>
          <p className="text-sm text-text-muted">
            Select a structure from the navigation or structures overview to inspect capacity, rooms, and workforce details.
          </p>
        </div>
      </section>
    );
  }

  return <StructurePage structureId={structure.id} />;
}

