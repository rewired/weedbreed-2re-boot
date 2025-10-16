import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { LightingControlCard, ClimateControlCard } from "@ui/components/controls";
import type { ControlCardGhostActionPayload } from "@ui/components/controls/ControlCard";
import { ZoneActionsPanel } from "@ui/components/zones/ZoneActionsPanel";
import { ZoneClimateSnapshot } from "@ui/components/zones/ZoneClimateSnapshot";
import { ZoneDevicesPanel } from "@ui/components/zones/ZoneDevicesPanel";
import { ZoneHeader } from "@ui/components/zones/ZoneHeader";
import { ZoneKpiPanel } from "@ui/components/zones/ZoneKpiPanel";
import { ZonePestPanel } from "@ui/components/zones/ZonePestPanel";
import { useZoneDetailView } from "@ui/pages/zoneDetailHooks";
import { buildStructureCapacityAdvisorPath } from "@ui/lib/navigation";
import { useIntentClient } from "@ui/transport";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";
import { ZoneMoveDialog } from "@ui/components/flows/ZoneMoveDialog";
import { useStructureReadModel } from "@ui/lib/readModelHooks";

export interface ZoneDetailPageProps {
  readonly structureId: string;
  readonly roomId: string | null;
  readonly zoneId: string;
}

export function ZoneDetailPage({ structureId, roomId, zoneId }: ZoneDetailPageProps): ReactElement {
  const snapshot = useZoneDetailView(structureId, roomId, zoneId);
  const navigate: NavigateFunction = useNavigate();
  const intentClient = useIntentClient();
  const renameDisabledReason = intentClient ? undefined : "Intent transport unavailable.";
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const structure = useStructureReadModel(structureId);
  const rooms = structure?.rooms ?? [];
  const containingRoom = useMemo(() => {
    if (roomId) {
      return rooms.find((room) => room.id === roomId) ?? null;
    }
    return rooms.find((room) => room.zones.some((zone) => zone.id === zoneId)) ?? null;
  }, [rooms, roomId, zoneId]);
  const zoneModel = useMemo(() => {
    return containingRoom?.zones.find((zone) => zone.id === zoneId) ?? null;
  }, [containingRoom, zoneId]);
  const currentRoomId = roomId ?? containingRoom?.id ?? null;
  const zoneArea = zoneModel?.area_m2 ?? 0;
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
    <section aria-label={`Zone detail for ${snapshot.header.zoneName}`} className="flex flex-1 flex-col gap-6">
      <ZoneHeader
        header={snapshot.header}
        onRename={async (nextName) => {
          if (!intentClient) {
            throw new Error("Intent transport unavailable.");
          }

          await submitIntentOrThrow(intentClient, {
            type: "intent.zone.rename.v1",
            structureId,
            zoneId,
            name: nextName
          });
        }}
        renameDisabledReason={renameDisabledReason}
      />

      <ZoneKpiPanel kpis={snapshot.kpis} />

      <ZonePestPanel pest={snapshot.pest} />

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

      <ZoneClimateSnapshot climate={snapshot.climate} />

      <ZoneDevicesPanel groups={snapshot.deviceGroups} />

      <ZoneActionsPanel
        actions={[
          {
            id: "zone-action-move",
            label: "Move zone",
            disabled: !intentClient,
            disabledReason: intentClient ? "" : "Intent transport unavailable.",
            onSelect: () => {
              setIsMoveDialogOpen(true);
            }
          },
          ...snapshot.actions
        ]}
        deviceControls={snapshot.deviceControls}
      />

      <ZoneMoveDialog
        isOpen={isMoveDialogOpen}
        structureId={structureId}
        zoneId={zoneId}
        zoneName={snapshot.header.zoneName}
        zoneArea={zoneArea}
        currentRoomId={currentRoomId}
        rooms={rooms}
        intentClient={intentClient}
        onClose={() => {
          setIsMoveDialogOpen(false);
        }}
      />
    </section>
  );
}

