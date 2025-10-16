import type { ReactElement } from "react";
import { ZoneActionsPanel } from "@ui/components/zones/ZoneActionsPanel";
import { ZoneClimateSnapshot } from "@ui/components/zones/ZoneClimateSnapshot";
import { ZoneDevicesPanel } from "@ui/components/zones/ZoneDevicesPanel";
import { ZoneHeader } from "@ui/components/zones/ZoneHeader";
import { ZoneKpiPanel } from "@ui/components/zones/ZoneKpiPanel";
import { ZonePestPanel } from "@ui/components/zones/ZonePestPanel";
import { useZoneDetailView } from "@ui/pages/zoneDetailHooks";

export interface ZoneDetailPageProps {
  readonly structureId: string;
  readonly roomId: string | null;
  readonly zoneId: string;
}

export function ZoneDetailPage({ structureId, roomId, zoneId }: ZoneDetailPageProps): ReactElement {
  const snapshot = useZoneDetailView(structureId, roomId, zoneId);

  return (
    <section aria-label={`Zone detail for ${snapshot.header.zoneName}`} className="flex flex-1 flex-col gap-6">
      <ZoneHeader header={snapshot.header} />

      <ZoneKpiPanel kpis={snapshot.kpis} />

      <ZonePestPanel pest={snapshot.pest} />

      <ZoneClimateSnapshot climate={snapshot.climate} />

      <ZoneDevicesPanel groups={snapshot.deviceGroups} />

      <ZoneActionsPanel actions={snapshot.actions} deviceControls={snapshot.deviceControls} />
    </section>
  );
}

