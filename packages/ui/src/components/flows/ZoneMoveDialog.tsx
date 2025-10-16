import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { AlertTriangle, ArrowRight, DoorOpen } from "lucide-react";
import type { IntentClient } from "@ui/transport";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";
import type { RoomReadModel } from "@ui/state/readModels.types";

interface ZoneMoveOption {
  readonly roomId: string;
  readonly roomName: string;
  readonly purpose: string;
  readonly areaFree: number;
  readonly disabled: boolean;
  readonly reason: string | null;
}

export interface ZoneMoveDialogProps {
  readonly isOpen: boolean;
  readonly structureId: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly zoneArea: number;
  readonly currentRoomId: string | null;
  readonly rooms: readonly RoomReadModel[];
  readonly intentClient: IntentClient | null;
  readonly onClose: () => void;
}

const areaFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatArea(value: number): string {
  return `${areaFormatter.format(value)} m²`;
}

function buildOptions(
  rooms: readonly RoomReadModel[],
  currentRoomId: string | null,
  zoneArea: number
): readonly ZoneMoveOption[] {
  return rooms
    .map((room) => {
      if (room.id === currentRoomId) {
        return {
          roomId: room.id,
          roomName: room.name,
          purpose: room.purpose,
          areaFree: room.capacity.areaFree_m2,
          disabled: true,
          reason: "Zone already assigned to this room."
        } satisfies ZoneMoveOption;
      }

      if (room.purpose !== "growroom") {
        return {
          roomId: room.id,
          roomName: room.name,
          purpose: room.purpose,
          areaFree: room.capacity.areaFree_m2,
          disabled: true,
          reason: "Room purpose does not support zones."
        } satisfies ZoneMoveOption;
      }

      if (room.capacity.areaFree_m2 < zoneArea) {
        const deficit = Math.max(0, zoneArea - room.capacity.areaFree_m2);
        return {
          roomId: room.id,
          roomName: room.name,
          purpose: room.purpose,
          areaFree: room.capacity.areaFree_m2,
          disabled: true,
          reason: `Requires ${formatArea(zoneArea)} free. Short by ${formatArea(deficit)}.`
        } satisfies ZoneMoveOption;
      }

      return {
        roomId: room.id,
        roomName: room.name,
        purpose: room.purpose,
        areaFree: room.capacity.areaFree_m2,
        disabled: false,
        reason: null
      } satisfies ZoneMoveOption;
    })
    .sort((left, right) => left.roomName.localeCompare(right.roomName));
}

export function ZoneMoveDialog({
  isOpen,
  structureId,
  zoneId,
  zoneName,
  zoneArea,
  currentRoomId,
  rooms,
  intentClient,
  onClose
}: ZoneMoveDialogProps): ReactElement | null {
  const options = useMemo(
    () => buildOptions(rooms, currentRoomId, zoneArea),
    [rooms, currentRoomId, zoneArea]
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRoomId(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, zoneId]);

  if (!isOpen) {
    return null;
  }

  const selectedOption = options.find((option) => option.roomId === selectedRoomId) ?? null;
  const intentsUnavailable = intentClient === null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedRoomId) {
      setError("Select a destination room.");
      return;
    }

    if (selectedOption?.disabled) {
      setError(selectedOption.reason ?? "Selected room cannot host this zone.");
      return;
    }

    if (!intentClient) {
      setError("Intent transport unavailable.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await submitIntentOrThrow(intentClient, {
        type: "intent.zone.move.v1",
        structureId,
        zoneId,
        targetRoomId: selectedRoomId
      });
      onClose();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message.length > 0 ? message : "Failed to submit zone move intent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl space-y-4 rounded-xl border border-border-base bg-canvas-base p-6 shadow-lg"
        aria-label={`Move zone ${zoneName}`}
      >
        <div className="flex items-center gap-2">
          <DoorOpen aria-hidden="true" className="size-5 text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Move zone</h2>
        </div>
        <p className="text-sm text-text-muted">
          Select a destination room within this structure. Targets must be growrooms with enough free area to host the
          zone footprint of {formatArea(zoneArea)}.
        </p>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text-primary">Eligible rooms</legend>
          {options.length === 0 ? (
            <p className="text-sm text-text-muted">No rooms available in this structure.</p>
          ) : (
            <ul className="space-y-2">
              {options.map((option) => (
                <li key={option.roomId}>
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition ${
                      option.disabled
                        ? "border-border-base bg-canvas-subtle text-text-muted"
                        : "border-border-base bg-canvas-base hover:border-accent-primary/40 hover:bg-canvas-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="zone-move-target"
                        value={option.roomId}
                        checked={selectedRoomId === option.roomId}
                        onChange={() => {
                          setSelectedRoomId(option.roomId);
                          setError(null);
                        }}
                        disabled={option.disabled}
                      />
                      <span className="text-sm font-medium text-text-primary">{option.roomName}</span>
                      <ArrowRight aria-hidden="true" className="size-4 text-text-muted" />
                      <span className="text-xs uppercase tracking-[0.18em] text-accent-muted">{option.purpose}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      Free area: {formatArea(option.areaFree)}
                    </div>
                    {option.disabled && option.reason ? (
                      <div className="flex items-center gap-1 text-xs text-accent-critical">
                        <AlertTriangle aria-hidden="true" className="size-3" />
                        <span>{option.reason}</span>
                      </div>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {error ? <p className="text-sm text-accent-critical">{error}</p> : null}
        {intentsUnavailable ? (
          <p className="text-xs text-text-muted">Intents offline. Connect to transport to move zones.</p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-sm text-text-muted transition hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
            onClick={() => {
              setSelectedRoomId(null);
              setError(null);
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/60 bg-accent-primary/10 px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised disabled:opacity-60"
            disabled={
              isSubmitting || intentsUnavailable || !selectedRoomId || (selectedOption?.disabled ?? false)
            }
          >
            Move zone
          </button>
        </div>
      </form>
    </div>
  );
}
