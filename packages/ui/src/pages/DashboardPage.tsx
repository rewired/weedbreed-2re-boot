import type { ReactElement } from "react";
import { Activity, Clock3, Coins, Droplets, ScrollText, Zap } from "lucide-react";
import "@ui/styles/dashboard.css";
import { useDashboardSnapshot } from "@ui/pages/dashboardHooks";

export function DashboardPage(): ReactElement {
  const snapshot = useDashboardSnapshot();
  const { tickRate, clock, costs, resources, events } = snapshot;
  const formattedHour = clock.hour.toString().padStart(2, "0");
  const formattedMinute = clock.minute.toString().padStart(2, "0");

  return (
    <section aria-label="Simulation dashboard" className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Dashboard</p>
        <div className="flex items-center gap-3">
          <Activity aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Operations dashboard</h2>
        </div>
        <p className="text-sm text-text-muted">
          Live tick cadence, simulation calendar, economy rollups, and utility usage sourced from telemetry and read models.
        </p>
      </header>

      <div className="dashboard-grid">
        <section aria-labelledby="dashboard-tick-rate" className="dashboard-card">
          <div className="dashboard-card__heading">
            <Activity aria-hidden="true" className="size-4 text-accent-primary" />
            <h3 className="dashboard-card__title" id="dashboard-tick-rate">
              Tick rate
            </h3>
          </div>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="dashboard-card__meta">Actual</dt>
              <dd className="dashboard-card__metric">{tickRate.actualTicksPerHour}</dd>
            </div>
            <div>
              <dt className="dashboard-card__meta">Target</dt>
              <dd className="text-sm text-text-muted">{tickRate.targetTicksPerHour}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="dashboard-clock" className="dashboard-card">
          <div className="dashboard-card__heading">
            <Clock3 aria-hidden="true" className="size-4 text-accent-primary" />
            <h3 className="dashboard-card__title" id="dashboard-clock">
              Simulation time
            </h3>
          </div>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="dashboard-card__meta">Day</dt>
              <dd className="dashboard-card__metric">{clock.day}</dd>
            </div>
            <div>
              <dt className="dashboard-card__meta">Tick pipeline phase</dt>
              <dd className="text-sm text-text-muted">SEC §4.2 cadence · {formattedHour}:{formattedMinute}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="dashboard-costs" className="dashboard-card">
          <div className="dashboard-card__heading">
            <Coins aria-hidden="true" className="size-4 text-accent-primary" />
            <h3 className="dashboard-card__title" id="dashboard-costs">
              Daily cost rollup
            </h3>
          </div>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="dashboard-card__meta">Operating</dt>
              <dd className="dashboard-card__metric">{costs.operatingCostPerHour}</dd>
            </div>
            <div>
              <dt className="dashboard-card__meta">Labour</dt>
              <dd className="dashboard-card__metric">{costs.labourCostPerHour}</dd>
            </div>
            <div>
              <dt className="dashboard-card__meta">Utilities</dt>
              <dd className="dashboard-card__metric">{costs.utilitiesCostPerHour}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="dashboard-resources" className="dashboard-card">
          <div className="dashboard-card__heading">
            <Zap aria-hidden="true" className="size-4 text-accent-primary" />
            <h3 className="dashboard-card__title" id="dashboard-resources">
              Energy &amp; water
            </h3>
          </div>
          <dl className="mt-4 space-y-3">
            <div className="space-y-1">
              <dt className="dashboard-card__meta flex items-center gap-2">
                <Zap aria-hidden="true" className="size-4 text-accent-primary" />
                <span>Energy</span>
              </dt>
              <dd className="dashboard-card__metric">{resources.energyKwhPerDay}</dd>
              <dd className="dashboard-card__meta">{resources.energyCostPerHour}</dd>
            </div>
            <div className="space-y-1">
              <dt className="dashboard-card__meta flex items-center gap-2">
                <Droplets aria-hidden="true" className="size-4 text-accent-primary" />
                <span>Water</span>
              </dt>
              <dd className="dashboard-card__metric">{resources.waterCubicMetersPerDay}</dd>
              <dd className="dashboard-card__meta">{resources.waterCostPerHour}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="dashboard-events" className="dashboard-card">
        <div className="dashboard-card__heading">
          <ScrollText aria-hidden="true" className="size-4 text-accent-primary" />
          <h3 className="dashboard-card__title" id="dashboard-events">
            Event stream
          </h3>
        </div>
        <p className="dashboard-card__meta mt-3">Pending incidents surfaced directly from the simulation timeline.</p>
        <ul className="dashboard-events__list" aria-label="Upcoming events">
          {events.map((event) => (
            <li key={event.id} className="dashboard-events__item">
              <span className="dashboard-events__time">{event.relativeTime}</span>
              <p className="text-sm text-text-primary">{event.label}</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
