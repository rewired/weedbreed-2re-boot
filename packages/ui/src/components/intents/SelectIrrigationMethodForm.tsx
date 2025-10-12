import { useMemo, useState, type FormEvent } from "react";
import type { ReactElement } from "react";
import type { IntentClient, IntentSubmissionHandlers, IntentSubmissionResult } from "@ui/transport";
import type { IntentErrorDictionaryEntry } from "@ui/intl/intentErrors";
import { publishToast } from "@ui/state/toast";
import { cn } from "@ui/lib/cn";

const INTENT_TYPE = "intent.selectIrrigationMethod.v1" as const;

export interface IrrigationMethodOption {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface SelectIrrigationMethodFormProps {
  readonly zoneId: string;
  readonly irrigationMethods: readonly IrrigationMethodOption[];
  readonly intentClient: IntentClient;
}

function resolveSuccessDescription(methodName: string | undefined): string {
  if (!methodName || methodName.length === 0) {
    return "Irrigation method updated.";
  }

  return `Zone irrigation switched to ${methodName}.`;
}

export function SelectIrrigationMethodForm({
  zoneId,
  irrigationMethods,
  intentClient
}: SelectIrrigationMethodFormProps): ReactElement {
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ackFailure, setAckFailure] = useState<IntentErrorDictionaryEntry | null>(null);
  const [fatalSubmissionError, setFatalSubmissionError] = useState<string | null>(null);

  const selectedMethod = useMemo(
    () => irrigationMethods.find((method) => method.id === selectedMethodId) ?? null,
    [irrigationMethods, selectedMethodId]
  );

  const canSubmit = selectedMethodId.length > 0 && !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedMethodId || selectedMethodId.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setAckFailure(null);
    setFatalSubmissionError(null);

    const handlers: IntentSubmissionHandlers = {
      onResult(result: IntentSubmissionResult) {
        if (result.ok) {
          setAckFailure(null);
          return;
        }

        setAckFailure(result.dictionary);
      }
    };

    try {
      const result = await intentClient.submit(
        {
          type: INTENT_TYPE,
          zoneId,
          methodId: selectedMethodId
        },
        handlers
      );

      if (result.ok) {
        publishToast({
          variant: "success",
          title: "Irrigation method updated",
          description: resolveSuccessDescription(selectedMethod?.name)
        });
        setSelectedMethodId("");
        return;
      }

      publishToast({
        variant: "error",
        title: result.dictionary.title,
        description: result.dictionary.description
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Intent submission failed before acknowledgement.";
      setFatalSubmissionError(message);
      publishToast({
        variant: "error",
        title: "Irrigation submission failed",
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-label="Select irrigation method"
      className="space-y-4"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-primary" htmlFor="irrigation-method-select">
          Irrigation method
        </label>
        <select
          id="irrigation-method-select"
          name="irrigationMethod"
          className="rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
          value={selectedMethodId}
          onChange={(event) => {
            setSelectedMethodId(event.currentTarget.value);
          }}
          disabled={isSubmitting || irrigationMethods.length === 0}
          aria-disabled={isSubmitting || irrigationMethods.length === 0}
        >
          <option value="" disabled>
            Select an irrigation method
          </option>
          {irrigationMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
        {selectedMethod?.description ? (
          <p className="text-xs text-text-muted">{selectedMethod.description}</p>
        ) : null}
      </div>

      {ackFailure ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3" role="alert">
          <p className="text-sm font-semibold text-destructive">{ackFailure.title}</p>
          <p className="mt-1 text-xs text-destructive">{ackFailure.description}</p>
          <p className="mt-2 text-xs text-text-primary">{ackFailure.action}</p>
        </div>
      ) : null}

      {fatalSubmissionError ? (
        <p className="text-sm text-destructive" role="alert">
          {fatalSubmissionError}
        </p>
      ) : null}

      <button
        type="submit"
        className={cn(
          "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition",
          canSubmit
            ? "border-accent-primary bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30"
            : "cursor-not-allowed border-border-base bg-canvas-subtle text-text-muted"
        )}
        disabled={!canSubmit}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block size-3 animate-spin rounded-full border border-current border-t-transparent"
            />
            Submitting…
          </span>
        ) : (
          "Update irrigation method"
        )}
      </button>
    </form>
  );
}
