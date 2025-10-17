import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactElement } from "react";
import { type IntentClient, type IntentSubmissionHandlers, type SuccessfulIntentAck } from "@ui/transport";
import type { IntentErrorDictionaryEntry } from "@ui/intl/intentErrors";
import en from "@ui/intl/en.json" assert { type: "json" };
import {
  recordZoneLightSchedule,
  useZoneLightSchedule,
  type ZoneLightSchedule
} from "@ui/state/intents";
import { SOCKET_ERROR_CODES, type TransportAckErrorCode } from "@wb/transport-sio";
import { HOURS_PER_DAY, LIGHT_SCHEDULE_GRID_HOURS } from "@engine/constants/simConstants.ts";
import {
  normalizeLightSchedule,
  validateLightScheduleInput,
  type LightScheduleValidationMessages,
  type LightScheduleValidationStatusMap
} from "@ui/lib/lightScheduleValidation";
import type { ValidationStatusDetail } from "@ui/lib/validation";

const copy = en.intents.setLightSchedule;
const START_HOUR_MAX = HOURS_PER_DAY - LIGHT_SCHEDULE_GRID_HOURS;

interface FormValues {
  readonly onHours: string;
  readonly offHours: string;
  readonly startHour: string;
}

export interface SetLightScheduleFormProps {
  readonly zoneId: string;
  readonly intentClient: IntentClient;
  readonly className?: string;
}

function parseHours(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

interface ToastMessage {
  readonly title: string;
  readonly description: string;
}

function deriveErrorEntry(
  dictionary: IntentErrorDictionaryEntry | null,
  code: TransportAckErrorCode,
  message: string
): IntentErrorDictionaryEntry {
  if (dictionary) {
    return dictionary;
  }

  return {
    code,
    title: copy.status.toastErrorTitle,
    description: message,
    action: "Retry the submission after checking your connection."
  } satisfies IntentErrorDictionaryEntry;
}

function formatHours(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.00$/, "");
}

const validationMessages: LightScheduleValidationMessages = {
  sum: copy.validation.sum,
  grid: copy.validation.quarter,
  start: copy.validation.start
};

export function SetLightScheduleForm({ zoneId, intentClient, className }: SetLightScheduleFormProps): ReactElement {
  const schedule = useZoneLightSchedule(zoneId);
  const [values, setValues] = useState<FormValues>(() => {
    const normalized = normalizeLightSchedule(schedule);
    return {
      onHours: formatHours(normalized.onHours),
      offHours: formatHours(normalized.offHours),
      startHour: formatHours(normalized.startHour)
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ackError, setAckError] = useState<IntentErrorDictionaryEntry | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [successAck, setSuccessAck] = useState<SuccessfulIntentAck | null>(null);

  useEffect(() => {
    const normalized = normalizeLightSchedule(schedule);
    setValues({
      onHours: formatHours(normalized.onHours),
      offHours: formatHours(normalized.offHours),
      startHour: formatHours(normalized.startHour)
    });
  }, [schedule.onHours, schedule.offHours, schedule.startHour]);

  const validationResult = useMemo(() => {
    return validateLightScheduleInput(
      {
        onHours: parseHours(values.onHours),
        offHours: parseHours(values.offHours),
        startHour: parseHours(values.startHour)
      },
      validationMessages
    );
  }, [values.offHours, values.onHours, values.startHour]);

  const validationErrors = validationResult.errors;
  const activeStatuses = useMemo(() => {
    const entries = Object.entries(validationResult.status) as Array<
      [keyof LightScheduleValidationStatusMap, ValidationStatusDetail]
    >;
    return entries.filter(([, detail]) => detail.status !== "ok");
  }, [validationResult.status]);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((previous) => ({
      ...previous,
      [field]: event.target.value
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = validateLightScheduleInput(
      {
        onHours: parseHours(values.onHours),
        offHours: parseHours(values.offHours),
        startHour: parseHours(values.startHour)
      },
      validationMessages
    );

    if (!result.isValid || result.schedule === null) {
      return;
    }

    setIsSubmitting(true);
    setAckError(null);
    setSuccessAck(null);
    setToast(null);

    const payload = {
      type: "zone.light-schedule.set",
      zoneId,
      schedule: result.schedule
    } satisfies Record<string, unknown>;

    const handlers: IntentSubmissionHandlers = {
      onResult: () => undefined
    };

    try {
      const resultAck = await intentClient.submit(payload, handlers);
      if (resultAck.ok) {
        const normalized = normalizeLightSchedule(result.schedule);
        const normalizedSchedule: ZoneLightSchedule = {
          onHours: normalized.onHours,
          offHours: normalized.offHours,
          startHour: normalized.startHour
        };
        recordZoneLightSchedule(zoneId, normalizedSchedule);
        setValues({
          onHours: formatHours(normalizedSchedule.onHours),
          offHours: formatHours(normalizedSchedule.offHours),
          startHour: formatHours(normalizedSchedule.startHour)
        });
        setSuccessAck(resultAck.ack);
        setAckError(null);
        setToast(null);
      } else {
        const errorEntry: IntentErrorDictionaryEntry = deriveErrorEntry(
          resultAck.dictionary,
          resultAck.ack.error.code,
          resultAck.ack.error.message
        );
        setAckError(errorEntry);
        setToast({
          title: copy.status.toastErrorTitle,
          description: errorEntry.title
        });
      }
    } catch (error) {
      setAckError(
        deriveErrorEntry(
          null,
          SOCKET_ERROR_CODES.TRANSPORT_DISCONNECTED as TransportAckErrorCode,
          error instanceof Error ? error.message : "transport error"
        )
      );
      setToast({
        title: copy.status.toastErrorTitle,
        description: copy.status.toastErrorDescription
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      aria-describedby="set-light-schedule-description"
      className={className ?? "space-y-6 rounded-xl border border-border-base bg-canvas-base p-6"}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-text-primary">{copy.title}</h3>
        <p className="text-sm text-text-muted" id="set-light-schedule-description">
          {copy.description}
        </p>
      </div>

      {toast && (
        <div
          aria-live="assertive"
          className="rounded-lg border border-border-strong bg-surface-critical/10 p-4 text-sm text-text-primary"
          role="alert"
        >
          <p className="font-semibold text-text-critical">{toast.title}</p>
          <p className="text-text-muted">{toast.description}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-primary">{copy.fields.onHours.label}</span>
          <input
            aria-label={copy.fields.onHours.label}
            className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
            inputMode="decimal"
            min={0}
            max={HOURS_PER_DAY}
            name="onHours"
            onChange={handleChange("onHours")}
            step={LIGHT_SCHEDULE_GRID_HOURS}
            type="number"
            value={values.onHours}
            aria-invalid={!validationResult.isValid}
          />
          <span className="text-xs text-text-muted">{copy.fields.onHours.help}</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-primary">{copy.fields.offHours.label}</span>
          <input
            aria-label={copy.fields.offHours.label}
            className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
            inputMode="decimal"
            min={0}
            max={HOURS_PER_DAY}
            name="offHours"
            onChange={handleChange("offHours")}
            step={LIGHT_SCHEDULE_GRID_HOURS}
            type="number"
            value={values.offHours}
            aria-invalid={!validationResult.isValid}
          />
          <span className="text-xs text-text-muted">{copy.fields.offHours.help}</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-primary">{copy.fields.startHour.label}</span>
          <input
            aria-label={copy.fields.startHour.label}
            className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
            inputMode="decimal"
            min={0}
            max={START_HOUR_MAX}
            name="startHour"
            onChange={handleChange("startHour")}
            step={LIGHT_SCHEDULE_GRID_HOURS}
            type="number"
            value={values.startHour}
            aria-invalid={!validationResult.isValid}
          />
          <span className="text-xs text-text-muted">{copy.fields.startHour.help}</span>
        </label>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-border-strong bg-surface-critical/10 p-4" role="alert">
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-critical">
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {activeStatuses.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted" aria-live="polite">
          {activeStatuses.map(([key, detail]) => (
            <li key={key} data-status={detail.status}>
              {detail.message}
            </li>
          ))}
        </ul>
      )}

      {ackError && (
        <div className="space-y-2 rounded-lg border border-border-strong bg-surface-critical/10 p-4" role="alert">
          <p className="text-sm font-semibold text-text-critical">{ackError.title}</p>
          <p className="text-sm text-text-primary">{ackError.description}</p>
          <p className="text-xs text-text-muted">{ackError.action}</p>
        </div>
      )}

      {successAck && (
        <div className="rounded-lg border border-border-success bg-surface-success/10 p-4" role="status">
          <p className="text-sm font-medium text-text-success">{copy.status.success}</p>
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!validationResult.isValid || isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <span className="inline-flex size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              <span>{copy.status.submitting}</span>
            </>
          ) : (
            copy.actions.submit
          )}
        </button>
      </div>
    </form>
  );
}
