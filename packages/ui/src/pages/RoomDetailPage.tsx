import { useCallback, type ReactElement } from "react";
import { Link, useInRouterContext, useNavigate, type NavigateFunction } from "react-router-dom";
import { LightingControlCard, ClimateControlCard } from "@ui/components/controls";
import type { ControlCardGhostActionPayload } from "@ui/components/controls/ControlCard";
import { RoomClimateSnapshot } from "@ui/components/rooms/RoomClimateSnapshot";
import { RoomDevicesPanel } from "@ui/components/rooms/RoomDevicesPanel";
import { RoomHeader } from "@ui/components/rooms/RoomHeader";
import { RoomTimelinePanel } from "@ui/components/rooms/RoomTimelinePanel";
import { RoomZonesList } from "@ui/components/rooms/RoomZonesList";
import { buildRoomBreadcrumbs, buildStructureCapacityAdvisorPath } from "@ui/lib/navigation";
import { useRoomDetailView } from "@ui/pages/roomDetailHooks";
import { useIntentClient } from "@ui/transport";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";

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
  const navigate: NavigateFunction = useNavigate();
  const intentClient = useIntentClient();
  const renameDisabledReason = intentClient ? undefined : "Intent transport unavailable.";
  const handleGhostAction = useCallback(
    (payload: ControlCardGhostActionPayload) => {
      console.info("[stub] open capacity advisor", {
        structureId,
        origin: payload
      });
      navigate(buildStructureCapacityAdvisorPath(structureId));
    },
    [navigate, structureId]
  );

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
        onRename={async (nextName) => {
          if (!intentClient) {
            throw new Error("Intent transport unavailable.");
          }

          await submitIntentOrThrow(intentClient, {
            type: "intent.room.rename.v1",
            structureId,
            roomId,
            name: nextName
          });
        }}
        renameDisabledReason={renameDisabledReason}
      />

      <RoomZonesList zones={snapshot.zones} />

      <LightingControlCard
        title={snapshot.controls.lighting.title}
        description={snapshot.controls.lighting.description ?? undefined}
        measuredPpfd={snapshot.controls.lighting.measuredPpfd}
        targetPpfd={snapshot.controls.lighting.targetPpfd}
        deviation={snapshot.controls.lighting.deviation}
        schedule={snapshot.controls.lighting.schedule}
        onTargetPpfdChange={snapshot.controls.lighting.onTargetChange}
        onScheduleSubmit={snapshot.controls.lighting.onScheduleSubmit}
        isScheduleSubmitting={snapshot.controls.lighting.isScheduleSubmitting}
        deviceTiles={snapshot.controls.lighting.deviceTiles}
        ghostPlaceholders={snapshot.controls.lighting.ghostPlaceholders}
        deviceSectionEmptyLabel={snapshot.controls.lighting.deviceSectionEmptyLabel}
        scheduleSubmitLabel={snapshot.controls.lighting.scheduleSubmitLabel}
        onGhostAction={handleGhostAction}
      />

      <ClimateControlCard
        title={snapshot.controls.climate.title}
        description={snapshot.controls.climate.description ?? undefined}
        temperature={snapshot.controls.climate.temperature}
        humidity={snapshot.controls.climate.humidity}
        co2={snapshot.controls.climate.co2}
        ach={snapshot.controls.climate.ach}
        deviceClasses={snapshot.controls.climate.deviceClasses}
        ghostPlaceholders={snapshot.controls.climate.ghostPlaceholders}
        deviceSectionEmptyLabel={snapshot.controls.climate.deviceSectionEmptyLabel}
        onGhostAction={handleGhostAction}
      />

      <RoomClimateSnapshot climate={snapshot.climate} />

      <RoomDevicesPanel groups={snapshot.deviceGroups} />

      <RoomTimelinePanel timeline={snapshot.timeline} actions={snapshot.actions} />
    </section>
  );
}

