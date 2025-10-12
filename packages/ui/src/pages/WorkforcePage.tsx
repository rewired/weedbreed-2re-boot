import type { ReactElement } from "react";
import { AlertTriangle, ClipboardList, Gauge, Users2 } from "lucide-react";
import { WorkforceKpiCard } from "@ui/components/workforce/KpiCard";
import { useWorkforceSnapshot } from "@ui/state/workforce";
import type { WorkforceSnapshotOverrides } from "@ui/state/workforce";

export interface WorkforcePageProps {
  readonly overrides?: WorkforceSnapshotOverrides;
}

export function WorkforcePage({ overrides }: WorkforcePageProps = {}): ReactElement {
  const snapshot = useWorkforceSnapshot(overrides);
  const { headcount, roleMix, utilization, warnings } = snapshot;

  return (
    <section aria-label="Workforce KPIs" className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Workforce</p>
        <div className="flex items-center gap-3">
          <Users2 aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Labour KPI overview</h2>
        </div>
        <p className="text-sm text-text-muted">
          Placeholder labour analytics surface summarising headcount coverage, role distribution, utilisation, and operations
          warnings until read-model hydration lands.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <WorkforceKpiCard
            description="Snapshot of active staffing across cultivation, post-harvest, and facilities teams."
            icon={Users2}
            title="Headcount overview"
          >
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Total team members</dt>
                <dd className="text-base font-semibold">{headcount.totalTeamMembers}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Active</dt>
                  <dd className="font-medium text-text-primary">{headcount.activeTeamMembers}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Unavailable</dt>
                  <dd className="font-medium text-text-primary">{headcount.unavailableTeamMembers}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Open roles</dt>
                  <dd className="font-medium text-text-primary">{headcount.openRoles}</dd>
                </div>
              </div>
            </dl>
          </WorkforceKpiCard>

          <WorkforceKpiCard
            description="Role distribution expressed as percentage of total workforce." 
            icon={ClipboardList}
            title="Role mix"
          >
            <ul className="space-y-2">
              {roleMix.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3">
                  <span className="text-text-primary">{entry.roleName}</span>
                  <span className="text-sm text-text-muted">{entry.headcount} · {entry.percentOfTeam}%</span>
                </li>
              ))}
            </ul>
          </WorkforceKpiCard>

          <WorkforceKpiCard
            description="Utilisation compares assigned labour hours against SEC §4.2 pipeline demand."
            icon={Gauge}
            title="Utilisation"
          >
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Average utilisation</dt>
                <dd className="text-base font-semibold">{utilization.averageUtilizationPercent}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Target</dt>
                <dd className="text-base font-semibold">{utilization.targetUtilizationPercent}%</dd>
              </div>
              <div className="space-y-2">
                <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">Focus areas</dt>
                <ul className="list-disc space-y-1 pl-4 text-sm text-text-muted">
                  {utilization.focusAreas.map((focusArea) => (
                    <li key={focusArea}>{focusArea}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-text-muted">{utilization.notes}</p>
            </dl>
          </WorkforceKpiCard>
        </div>

        <section aria-labelledby="workforce-warnings" className="space-y-4 rounded-xl border border-border-base bg-canvas-subtle/60 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle aria-hidden="true" className="size-5 text-accent-warning" />
            <h3 className="text-lg font-semibold text-text-primary" id="workforce-warnings">
              Active warnings
            </h3>
          </div>
          {warnings.length > 0 ? (
            <ul className="space-y-3" aria-label="Workforce warnings">
              {warnings.map((warning) => (
                <li key={warning.id} className="rounded-lg border border-border-subtle bg-canvas-base/70 p-4">
                  <p className="text-sm font-semibold text-text-primary">
                    [{warning.severity.toUpperCase()}] {warning.message}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">{warning.suggestedAction}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              All workforce systems nominal. No warnings registered for the current simulation hour.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
