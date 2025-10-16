import { useCallback, type ReactElement } from "react";
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

export interface ZoneDetailPageProps {
  readonly structureId: string;
  readonly roomId: string | null;
  readonly zoneId: string;
}

export function ZoneDetailPage({ structureId, roomId, zoneId }: ZoneDetailPageProps): ReactElement {
  const snapshot = useZoneDetailView(structureId, roomId, zoneId);
  const navigate: NavigateFunction = useNavigate();
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
      <ZoneHeader header={snapshot.header} />

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

      <ZoneActionsPanel actions={snapshot.actions} deviceControls={snapshot.deviceControls} />
    </section>
  );
}

