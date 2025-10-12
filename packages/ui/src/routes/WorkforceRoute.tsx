import type { ReactElement } from "react";
import { Users2 } from "lucide-react";

export function WorkforceRoute(): ReactElement {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Workforce</p>
        <div className="flex items-center gap-3">
          <Users2 aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">Labour KPIs</h2>
        </div>
        <p className="text-sm text-text-muted">
          This placeholder surface will chart staffing, shift utilisation, and cultivation readiness metrics once read-model
          hydration lands.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6 text-sm text-text-muted">
          Staffing overview cards render here.
        </div>
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6 text-sm text-text-muted">
          Scheduling, payroll, and availability charts attach here.
        </div>
      </div>
    </section>
  );
}
