import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";
import { RoomDetailPage } from "@ui/pages/RoomDetailPage";
import { resolveRoomByParams } from "@ui/lib/navigation";

export function RoomDetailRoute(): ReactElement {
  const { structureId, roomId } = useParams();
  const resolved = resolveRoomByParams(structureId, roomId);

  if (!resolved) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-4 text-center lg:text-left">
        <AlertTriangle className="mx-auto size-10 text-accent-muted lg:mx-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text-primary">Room not found</h2>
          <p className="text-sm text-text-muted">
            Select a room from the structures overview to inspect climate baselines, zones, and device allocations.
          </p>
        </div>
      </section>
    );
  }

  return <RoomDetailPage structureId={resolved.structure.id} roomId={resolved.room.id} />;
}

