import type { ReactElement } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { AlertTriangle, Copy, MoveRight, Sparkles } from "lucide-react";

export interface StructureRoomAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabledReason?: string;
}

export interface StructureRoomWarning {
  readonly id: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
}

export interface StructureRoomSummary {
  readonly id: string;
  readonly name: string;
  readonly detailPath: string;
  readonly purposeLabel: string;
  readonly areaUsedLabel: string;
  readonly areaFreeLabel: string;
  readonly volumeUsedLabel: string;
  readonly volumeFreeLabel: string;
  readonly zoneCount: number;
  readonly warnings: readonly StructureRoomWarning[];
  readonly actions: readonly StructureRoomAction[];
}

export interface StructureRoomsGridProps {
  readonly rooms: readonly StructureRoomSummary[];
}

function renderWarningBadge(warning: StructureRoomWarning): ReactElement {
  const severityCopy = warning.severity === "critical" ? "Critical" : "Warning";
  return (
    <span
      key={warning.id}
      className="inline-flex items-center gap-2 rounded-full border border-accent-critical/60 bg-accent-critical/10 px-3 py-1 text-xs font-medium text-accent-critical"
    >
      <AlertTriangle aria-hidden="true" className="size-3" />
      <span>{`${severityCopy}: ${warning.message}`}</span>
    </span>
  );
}

function resolveActionIcon(action: StructureRoomAction): ReactElement {
  switch (action.id) {
    case "duplicate-room":
      return <Copy aria-hidden="true" className="size-4" />;
    case "move-device":
      return <MoveRight aria-hidden="true" className="size-4" />;
    case "open-capacity-advisor":
      return <Sparkles aria-hidden="true" className="size-4" />;
    default:
      return <Sparkles aria-hidden="true" className="size-4" />;
  }
}

export function StructureRoomsGrid({ rooms }: StructureRoomsGridProps): ReactElement {
  const hasRouterContext = useInRouterContext();

  return (
    <section aria-labelledby="structure-rooms-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="structure-rooms-heading">
          Rooms overview
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Room cards surface purpose, capacity, and zoning snapshot data. Duplicate, move, and capacity advisor buttons are
        stubbed pending Task 7000/8000 flows but retain deterministic identifiers for wiring.
      </p>
      <div className="structure-rooms-grid">
          {rooms.map((room) => (
            <article key={room.id} className="structure-room-card" aria-label={`${room.name} room summary`}>
              <div className="structure-room-card__header">
                {hasRouterContext ? (
                  <Link
                    to={room.detailPath}
                    className="text-lg font-semibold text-text-primary transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                  >
                    {room.name}
                  </Link>
                ) : (
                  <span className="text-lg font-semibold text-text-primary">{room.name}</span>
                )}
                <p className="structure-room-card__meta">
                  {room.purposeLabel} · Zones: {room.zoneCount}
                </p>
              <p className="text-sm text-text-primary">
                {room.areaUsedLabel} used · {room.areaFreeLabel} free
              </p>
              <p className="text-xs text-text-muted">{room.volumeUsedLabel} used · {room.volumeFreeLabel} free</p>
              {room.warnings.length > 0 ? (
                <div className="structure-room-card__warnings">
                  {room.warnings.map((warning) => renderWarningBadge(warning))}
                </div>
              ) : null}
            </div>
            <div className="structure-room-card__actions">
              {room.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                  onClick={action.onSelect}
                  title={action.disabledReason}
                >
                  {resolveActionIcon(action)}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

