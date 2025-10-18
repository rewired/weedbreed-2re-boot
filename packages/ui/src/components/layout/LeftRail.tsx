import { Fragment, type ReactElement, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dna,
  Factory,
  Leaf,
  Users2
} from "lucide-react";
import { workspaceCopy } from "@ui/design/tokens";
import { cn } from "@ui/lib/cn";
import {
  buildZonePath,
  useWorkspaceNavigation,
  workspaceTopLevelRoutes
} from "@ui/lib/navigation";

interface StructureAccordionState {
  expandedId: string | null;
}

const topLevelNavigation = [
  {
    key: "company",
    label: workspaceCopy.leftRail.sections.company.label,
    description: workspaceCopy.leftRail.sections.company.description,
    path: workspaceTopLevelRoutes.company.path,
    icon: Building2
  },
  {
    key: "structures",
    label: workspaceCopy.leftRail.sections.structures.label,
    description: workspaceCopy.leftRail.sections.structures.description,
    path: workspaceTopLevelRoutes.structures.path,
    icon: Factory
  },
  {
    key: "hr",
    label: workspaceCopy.leftRail.sections.hr.label,
    description: workspaceCopy.leftRail.sections.hr.description,
    path: workspaceTopLevelRoutes.hr.path,
    icon: Users2
  },
  {
    key: "strains",
    label: workspaceCopy.leftRail.sections.strains.label,
    description: workspaceCopy.leftRail.sections.strains.description,
    path: workspaceTopLevelRoutes.strains.path,
    icon: Dna
  }
] as const;

export function LeftRail(): ReactElement {
  const location = useLocation();
  const workspaceStructures = useWorkspaceNavigation();
  const [state, setState] = useState<StructureAccordionState>(() => ({
    expandedId: workspaceStructures[0]?.id ?? null
  }));
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (workspaceStructures.length === 0) {
      setState({ expandedId: null });
      return;
    }

    setState((current) => {
      if (current.expandedId && workspaceStructures.some((item) => item.id === current.expandedId)) {
        return current;
      }

      return { expandedId: workspaceStructures[0]?.id ?? null };
    });
  }, [workspaceStructures]);

  useEffect(() => {
    const activeStructure = workspaceStructures.find((structure) => {
      const structureBasePath = `/structures/${structure.id}`;
      if (location.pathname === structureBasePath || location.pathname.startsWith(`${structureBasePath}/`)) {
        return true;
      }

      return structure.zones.some((zone) => buildZonePath(structure.id, zone.id) === location.pathname);
    });

    if (!activeStructure) {
      return;
    }

    setState((current) => {
      if (current.expandedId === activeStructure.id) {
        return current;
      }

      return { expandedId: activeStructure.id };
    });
  }, [location.pathname, workspaceStructures]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setIsCollapsed(false);
      return;
    }

    const mediaQueryList = window.matchMedia("(min-width: 1024px)");

    const updateFromMatches = (matches: boolean) => {
      setIsCollapsed(!matches);
    };

    updateFromMatches(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === "function") {
      const handleChange = (event: MediaQueryListEvent) => {
        updateFromMatches(event.matches);
      };

      mediaQueryList.addEventListener("change", handleChange);

      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    return undefined;
  }, []);

  return (
    <div className="flex h-full flex-col gap-6" data-collapsed={isCollapsed}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-accent-muted">{workspaceCopy.appName}</span>
          <h1 className="text-2xl font-semibold text-text-primary">{workspaceCopy.leftRail.header}</h1>
        </div>
        <button
          type="button"
          className="mt-1 inline-flex size-9 items-center justify-center rounded-full border border-border-base bg-canvas-subtle/70 text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised lg:hidden"
          aria-pressed={!isCollapsed}
          aria-label={
            isCollapsed
              ? workspaceCopy.leftRail.collapseToggle.expand
              : workspaceCopy.leftRail.collapseToggle.collapse
          }
          onClick={() => {
            setIsCollapsed((current) => !current);
          }}
        >
          {isCollapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <p className="text-sm text-text-muted">{workspaceCopy.leftRail.placeholder}</p>

      <nav
        aria-label="Global navigation"
        className={cn(
          "flex-col gap-2",
          isCollapsed ? "hidden lg:flex" : "flex"
        )}
      >
        {topLevelNavigation.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "group flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised",
                "border-transparent bg-canvas-subtle/60 text-text-muted hover:border-accent-primary/40 hover:bg-canvas-subtle/90 hover:text-text-primary",
                isActive && "border-accent-primary/60 bg-accent-primary/10 text-text-primary"
              )
            }
          >
            <item.icon
              aria-hidden="true"
              className="mt-0.5 size-4 text-accent-muted transition group-hover:text-accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-medium text-text-primary">{item.label}</span>
              <span className="text-xs text-text-muted">{item.description}</span>
            </span>
          </NavLink>
        ))}
      </nav>

      <nav
        aria-label="Condensed navigation"
        className={cn(
          "grid-cols-3 gap-3 lg:hidden",
          isCollapsed ? "grid" : "hidden"
        )}
      >
        {topLevelNavigation.map((item) => (
          <NavLink
            key={`mini-${item.key}`}
            to={item.path}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised",
                "border-transparent bg-canvas-subtle/60 text-text-muted hover:border-accent-primary/40 hover:bg-canvas-subtle/90 hover:text-text-primary",
                isActive && "border-accent-primary/60 bg-accent-primary/10 text-text-primary"
              )
            }
          >
            <item.icon aria-hidden="true" className="size-4" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div
        className={cn(
          "flex flex-1 flex-col gap-4",
          isCollapsed ? "hidden lg:flex" : "flex"
        )}
      >
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent-muted">
          <Factory aria-hidden="true" className="size-4" /> {workspaceCopy.leftRail.sections.structures.label}
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
