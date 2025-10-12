import type { ReactElement } from "react";
import { workspaceCopy } from "@ui/design/tokens";

export function MainPlaceholder(): ReactElement {
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 text-center lg:text-left">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">{workspaceCopy.main.heading}</p>
        <h2 className="text-4xl font-semibold text-text-primary">Simulation workspace bootstrap</h2>
      </header>
      <p className="text-base leading-relaxed text-text-muted">
        {workspaceCopy.main.body}
      </p>
      <div className="flex flex-col items-center justify-center gap-3 text-sm text-text-muted lg:flex-row lg:justify-start">
        <span className="rounded-full border border-border-base bg-canvas-subtle/60 px-3 py-1 font-mono text-xs uppercase tracking-wider">
          SEC §4.2 pipeline ready
        </span>
        <span className="rounded-full border border-border-base bg-canvas-subtle/60 px-3 py-1 font-mono text-xs uppercase tracking-wider">
          Tailwind + shadcn tokens loaded
        </span>
      </div>
    </section>
  );
}
