import { useCallback, useMemo, type ReactElement } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { LightingControlCard, ClimateControlCard } from "@ui/components/controls";
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
import { SetTemperatureForm } from "@ui/components/intents/SetTemperatureForm";
import { ZoneSetupWizard } from "@ui/features/facility/ZoneSetupWizard";
import { useReadModelStore } from "@ui/state/readModels";
import { ZoneSowingPanel } from "@ui/features/grow/ZoneSowingPanel";
import { ZoneIncidentPanel } from "@ui/features/grow/ZoneIncidentPanel";
import { ZoneHarvestPanel } from "@ui/features/grow/ZoneHarvestPanel";
import { InventoryPanel } from "@ui/features/inventory/InventoryPanel";

export interface ZoneDetailPageProps {
  readonly structureId: string;
  readonly roomId: string | null;
  readonly zoneId: string;
}

export function ZoneDetailPage({ structureId, roomId, zoneId }: ZoneDetailPageProps): ReactElement {
  const snapshot = useZoneDetailView(structureId, roomId, zoneId);
  const navigate: NavigateFunction = useNavigate();
  const intentClient = useIntentClient();
  const { structures, priceBook, compatibility, simulation, inventory } = useReadModelStore((state) => state.snapshot);
  const setupContext = useMemo(() => {
    const structure = structures.find((entry) => entry.id === structureId);
    const room = structure?.rooms.find(
      (entry) => entry.id === roomId || entry.zones.some((zone) => zone.id === zoneId)
    );
    const zone = room?.zones.find((entry) => entry.id === zoneId);
    return room && zone ? { room, zone } : null;
  }, [structures, structureId, roomId, zoneId]);
  const incident = useMemo(() => {
    const zoneIncidents = simulation.pendingIncidents.filter((entry) => entry.zoneId === zoneId);
    return zoneIncidents.find((entry) => entry.status === "active") ?? zoneIncidents.at(-1) ?? null;
  }, [simulation.pendingIncidents, zoneId]);
  const renameDisabledReason = intentClient ? undefined : "Intent transport unavailable.";
  const handleGhostAction = useCallback(
    () => {
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

      {incident ? (
        <ZoneIncidentPanel incident={incident} simulationPaused={simulation.paused} />
      ) : null}

      {setupContext ? (
        <ZoneSetupWizard
          structureId={structureId}
          roomId={setupContext.room.id}
          zone={setupContext.zone}
          priceBook={priceBook}
          compatibility={compatibility}
          intentClient={intentClient}
        />
      ) : null}

      {setupContext ? (
        <ZoneSowingPanel
          structureId={structureId}
          roomId={setupContext.room.id}
          zone={setupContext.zone}
          intentClient={intentClient}
        />
      ) : null}

      {setupContext ? (
        <ZoneHarvestPanel
          structureId={structureId}
          roomId={setupContext.room.id}
          zone={setupContext.zone}
          intentClient={intentClient}
        />
      ) : null}

      {(inventory?.lots.some((lot) => lot.source.zoneId === zoneId) ?? false) ? (
        <InventoryPanel inventory={inventory} sourceZoneId={zoneId} />
      ) : null}

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

      {intentClient && (
        <SetTemperatureForm
          className="mt-2"
          structureId={structureId}
          zoneId={zoneId}
          initialTemperatureC={snapshot.controls.climate.temperature.target.numericValue ?? 24}
        />
      )}

      <ZoneClimateSnapshot climate={snapshot.climate} />

      <ZoneDevicesPanel groups={snapshot.deviceGroups} />

      <ZoneActionsPanel
        actions={snapshot.actions}
        deviceControls={snapshot.deviceControls}
      />
    </section>
  );
}
