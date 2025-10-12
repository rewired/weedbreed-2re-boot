import { Fragment, type ReactElement, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Factory, LayoutDashboard, Leaf, Users2 } from "lucide-react";
import { workspaceCopy } from "@ui/design/tokens";
import { cn } from "@ui/lib/cn";
import {
  buildZonePath,
  workspaceStructures,
  workspaceTopLevelRoutes
} from "@ui/lib/navigation";

interface StructureAccordionState {
  expandedId: string | null;
}

const topLevelNavigation = [
  {
    key: "dashboard",
    label: workspaceTopLevelRoutes.dashboard.label,
    path: workspaceTopLevelRoutes.dashboard.path,
    icon: LayoutDashboard
  },
  {
    key: "workforce",
    label: workspaceTopLevelRoutes.workforce.label,
    path: workspaceTopLevelRoutes.workforce.path,
    icon: Users2
  }
] as const;

export function LeftRail(): ReactElement {
  const location = useLocation();
  const [state, setState] = useState<StructureAccordionState>(() => ({
    expandedId: workspaceStructures[0]?.id ?? null
  }));

  useEffect(() => {
    const activeStructure = workspaceStructures.find((structure) =>
      structure.zones.some((zone) => buildZonePath(structure.id, zone.id) === location.pathname)
    );

    if (!activeStructure) {
      return;
    }

    setState((current) => {
      if (current.expandedId === activeStructure.id) {
        return current;
      }

      return { expandedId: activeStructure.id };
    });
  }, [location.pathname]);

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-[0.3em] text-accent-muted">{workspaceCopy.appName}</span>
        <h1 className="text-2xl font-semibold text-text-primary">{workspaceCopy.leftRail.header}</h1>
        <p className="text-sm text-text-muted">{workspaceCopy.leftRail.placeholder}</p>
      </div>

      <nav aria-label="Global navigation" className="flex flex-col gap-2">
        {topLevelNavigation.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised",
                "border-transparent bg-canvas-subtle/60 text-text-muted hover:border-accent-primary/40 hover:bg-canvas-subtle/90 hover:text-text-primary",
                isActive &&
                  "border-accent-primary/60 bg-accent-primary/10 text-text-primary"
              )
            }
          >
            <item.icon
              aria-hidden="true"
              className="size-4 text-accent-muted transition group-hover:text-accent-primary"
            />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-col gap-4">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent-muted">
          <Factory aria-hidden="true" className="size-4" /> Structures
        </h2>
        <div className="space-y-4" role="tree" aria-label="Structures and zones">
          {workspaceStructures.map((structure) => {
            const isExpanded = state.expandedId === structure.id;
            const activeStructure = location.pathname.startsWith(`/structures/${structure.id}`);

            return (
              <Fragment key={structure.id}>
                <button
                  type="button"
                  onClick={() => {
                    setState((current) => ({
                      expandedId: current.expandedId === structure.id ? null : structure.id
                    }));
                  }}
                  aria-expanded={isExpanded}
                  aria-controls={`${structure.id}-zones`}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
                    "border-transparent bg-canvas-subtle/60 text-text-primary hover:border-accent-primary/40 hover:bg-canvas-subtle/90",
                    activeStructure && "border-accent-primary/60 bg-accent-primary/10"
                  )}
                >
                  <span className="flex flex-col">
                    <span>{structure.name}</span>
                    <span className="text-xs text-text-muted">{structure.location}</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 text-accent-muted transition-transform",
                      isExpanded ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>
                <ul
                  id={`${structure.id}-zones`}
                  role="group"
                  className={cn(
                    "mt-2 space-y-1 pl-5",
                    isExpanded ? "block" : "hidden"
                  )}
                >
                  {structure.zones.map((zone) => (
                    <li key={zone.id}>
                      <NavLink
                        to={buildZonePath(structure.id, zone.id)}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised",
                            "text-text-muted hover:bg-canvas-subtle/80 hover:text-text-primary",
                            isActive && "bg-accent-primary/10 text-text-primary"
                          )
                        }
                      >
                        <Leaf aria-hidden="true" className="size-4 text-accent-muted transition group-hover:text-accent-primary" />
                        <div className="flex flex-col text-left">
                          <span>{zone.name}</span>
                          <span className="text-xs text-text-muted">{zone.cultivationMethod}</span>
                        </div>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
