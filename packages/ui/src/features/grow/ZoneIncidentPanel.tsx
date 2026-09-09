import type { ReactElement } from "react";

import { SetTemperatureForm } from "@ui/components/intents/SetTemperatureForm";
import { refreshReadModels } from "@ui/state/readModels";
import type { SimulationIncidentSummary } from "@ui/state/readModels.types";

export interface ZoneIncidentPanelProps {
  readonly incident: SimulationIncidentSummary;
  readonly simulationPaused: boolean;
  readonly onRefresh?: () => Promise<void>;
}

export function ZoneIncidentPanel({
  incident,
  simulationPaused,
  onRefresh = refreshReadModels
}: ZoneIncidentPanelProps): ReactElement {
  const recommendation = incident.recommendedIntent.payload;
  const isActive = incident.status === "active";

  return (
    <section aria-labelledby={`incident-${incident.id}`} className="rounded-xl border border-warning bg-warning/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`incident-${incident.id}`} className="text-lg font-semibold">
          {isActive ? "Klima-Incident aktiv" : "Klima-Incident gelöst"}
        </h2>
        <span>{simulationPaused ? "Zeitraffer pausiert (Serverstatus)" : "Simulation läuft (Serverstatus)"}</span>
      </div>
      <p className="mt-3">{incident.message}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <div><dt>Istwert</dt><dd>{incident.measured.value.toFixed(1)} °C</dd></div>
        <div><dt>Zielband</dt><dd>{incident.targetBand.min.toFixed(1)}–{incident.targetBand.max.toFixed(1)} °C</dd></div>
        <div><dt>Status</dt><dd>{isActive ? "aktiv" : `gelöst bei Tick ${String(incident.resolvedAtTick)}`}</dd></div>
      </dl>
      <p className="mt-3">
        Auswirkung: Hitzestress gefährdet Wachstum und Qualität von {incident.consequence.affectedPlantCount} Pflanzen
        {incident.consequence.averagePlantHealth01 === null
          ? "."
          : `; mittlere Gesundheit ${String(Math.round(incident.consequence.averagePlantHealth01 * 100))}%.`}
      </p>
      {isActive ? (
        <div className="mt-4">
          <p className="mb-2 font-medium">Aktion: Temperatur auf {recommendation.target.temperature_C.toFixed(1)} °C setzen.</p>
          <SetTemperatureForm
            structureId={recommendation.structureId}
            zoneId={recommendation.zoneId}
            initialTemperatureC={recommendation.target.temperature_C}
            onApplied={onRefresh}
          />
        </div>
      ) : null}
    </section>
  );
}
