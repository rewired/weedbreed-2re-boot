import type { ReactElement } from "react";
import { Layers3, Settings, Sparkles } from "lucide-react";
import { workspaceCopy } from "@ui/design/tokens";
import { cn } from "@ui/lib/cn";

const navigationItems = [
  { icon: Layers3, label: "Overview" },
  { icon: Sparkles, label: "Telemetry" },
  { icon: Settings, label: "Configuration" }
];

export function LeftRail(): ReactElement {
  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <span className="text-xs uppercase tracking-[0.3em] text-accent-muted">{workspaceCopy.appName}</span>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">{workspaceCopy.leftRail.header}</h1>
        <p className="mt-2 text-sm text-text-muted">{workspaceCopy.leftRail.placeholder}</p>
      </div>
      <nav aria-label="Workspace sections" className="flex flex-col gap-2">
        {navigationItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm transition", 
              "bg-canvas-subtle/60 text-text-muted hover:border-accent-primary/40 hover:bg-canvas-subtle/90 hover:text-text-primary"
            )}
          >
            <item.icon className="size-4 text-accent-muted transition group-hover:text-accent-primary" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
