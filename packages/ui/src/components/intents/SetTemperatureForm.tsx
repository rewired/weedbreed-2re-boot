import { useState, type FormEvent, type ReactElement } from "react";
import { useIntentClient } from "@ui/transport";
import { publishToast } from "@ui/state/toast";
import { resolveIntentError } from "@ui/intl/intentErrors";

export interface SetTemperatureFormProps {
  readonly structureId: string;
  readonly zoneId: string;
  readonly initialTemperatureC: number;
  readonly className?: string;
  readonly onApplied?: () => Promise<void>;
}

export function SetTemperatureForm({
  structureId,
  zoneId,
  initialTemperatureC,
  className,
  onApplied
}: SetTemperatureFormProps): ReactElement {
  const intentClient = useIntentClient();
  const [value, setValue] = useState<string>(() => String(initialTemperatureC));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    if (!intentClient) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await intentClient.submit(
        {
          type: "intent.zone.climate.adjust.v1",
          structureId,
          zoneId,
          target: { temperature_C: parsed }
        },
        {
          onResult(submission) {
            if (submission.ok) {
              publishToast({
                title: "Temperature setpoint updated",
                description: `New target: ${parsed.toFixed(1)} °C`,
                variant: "success"
              });
            } else {
              const entry = resolveIntentError(submission.ack.error.code);
              publishToast({
                title: entry.title,
                description: entry.description,
                variant: "error"
              });
            }
          }
        }
      );
      if (!result.ok) {
        setError(result.dictionary.description);
        return;
      }
      await onApplied?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Temperature could not be updated.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={className ?? "flex items-end gap-3 rounded-xl border border-border-base bg-canvas-base p-4"}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-primary" htmlFor="zone-temp-input">
          Temperature setpoint (°C)
        </label>
        <input
          id="zone-temp-input"
          className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
          type="number"
          step={0.1}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Applying…" : "Apply"}
      </button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}


