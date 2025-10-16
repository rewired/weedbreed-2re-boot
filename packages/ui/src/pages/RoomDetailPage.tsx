import type { ReactElement } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { RoomClimateSnapshot } from "@ui/components/rooms/RoomClimateSnapshot";
import { RoomDevicesPanel } from "@ui/components/rooms/RoomDevicesPanel";
import { RoomHeader } from "@ui/components/rooms/RoomHeader";
import { RoomTimelinePanel } from "@ui/components/rooms/RoomTimelinePanel";
import { RoomZonesList } from "@ui/components/rooms/RoomZonesList";
import { buildRoomBreadcrumbs } from "@ui/lib/navigation";
import { useRoomDetailView } from "@ui/pages/roomDetailHooks";

export interface RoomDetailPageProps {
  readonly structureId: string;
  readonly roomId: string;
}

export function RoomDetailPage({ structureId, roomId }: RoomDetailPageProps): ReactElement {
  const snapshot = useRoomDetailView(structureId, roomId);
  const breadcrumbs = buildRoomBreadcrumbs(
    structureId,
    snapshot.header.structureName,
    roomId,
    snapshot.header.roomName
  );
  const hasRouterContext = useInRouterContext();

  return (
    <section aria-label={`Room detail for ${snapshot.header.roomName}`} className="flex flex-1 flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.id} className="flex items-center gap-2">
              {hasRouterContext ? (
                <Link
                  to={crumb.path}
                  className="transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-muted">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
            </li>
          ))}
        </ol>
      </nav>

      <RoomHeader
        header={snapshot.header}
        onRename={(nextName) => {
          console.info("[stub] rename room", { structureId, roomId, nextName });
        }}
        renameDisabledReason="Rename flows land with Task 7010."
      />

      <RoomZonesList zones={snapshot.zones} />

      <RoomClimateSnapshot climate={snapshot.climate} />

      <RoomDevicesPanel groups={snapshot.deviceGroups} />

      <RoomTimelinePanel timeline={snapshot.timeline} actions={snapshot.actions} />
    </section>
  );
}

