import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent, type ReactElement } from "react";
import {
  ControlCard,
  type ControlCardGhostActionPayload,
  type ControlCardGhostPlaceholderDefinition
} from "@ui/components/controls/ControlCard";
import {
  normalizeLightSchedule,
  type LightScheduleInput,
  type LightScheduleValidationMessages,
  type LightScheduleValidationStatusMap,
  validateLightScheduleInput
} from "@ui/lib/lightScheduleValidation";
import en from "@ui/intl/en.json" assert { type: "json" };
import { cn } from "@ui/lib/cn";
import type { ValidationStatusDetail } from "@ui/lib/validation";
import { MICROMOLES_PER_MOLE } from "@engine/constants/lighting.ts";
import { HOURS_PER_DAY, LIGHT_SCHEDULE_GRID_HOURS, SECONDS_PER_HOUR } from "@engine/constants/simConstants.ts";

const targetFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dliFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

const copy = {
  targetLabel: "Target PPFD",
  targetHelp: "Set the desired PPFD for this zone.",
  dliLabel: "Daily light integral",
  dliUnit: "mol/m²/day",
  scheduleTitle: "Photoperiod schedule",
  submitLabel: "Save schedule",
  toggleEnable: "Enable",
  toggleDisable: "Disable",
  statusEnabled: "Enabled",
  statusDisabled: "Disabled"
} as const;

const defaultValidationMessages: LightScheduleValidationMessages = {
  sum: en.intents.setLightSchedule.validation.sum,
  grid: en.intents.setLightSchedule.validation.quarter,
  start: en.intents.setLightSchedule.validation.start
};

interface ScheduleInputsState {
  readonly onHours: string;
  readonly offHours: string;
  readonly startHour: string;
}

export interface LightingDeviceTileProps {
  readonly id: string;
  readonly name: string;
  readonly contributionFraction01: number;
  readonly isEnabled: boolean;
  readonly onToggle: (nextEnabled: boolean) => void;
  readonly description?: string;
}

export interface LightingControlCardProps {
  readonly title?: string;
  readonly description?: string;
  readonly measuredPpfd: number;
  readonly targetPpfd: number;
  readonly schedule: LightScheduleInput;
  readonly onTargetPpfdChange?: (nextValue: number) => void;
  readonly onScheduleSubmit?: (schedule: LightScheduleInput) => void;
  readonly isScheduleSubmitting?: boolean;
  readonly scheduleMessages?: Partial<LightScheduleValidationMessages>;
  readonly scheduleSubmitLabel?: string;
  readonly deviceTiles?: readonly LightingDeviceTileProps[];
  readonly ghostPlaceholders?: readonly ControlCardGhostPlaceholderDefinition[];
  readonly deviceSectionEmptyLabel?: string;
  readonly onGhostAction?: (payload: ControlCardGhostActionPayload) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function snapToGrid(value: number): number {
  return Math.round(value / LIGHT_SCHEDULE_GRID_HOURS) * LIGHT_SCHEDULE_GRID_HOURS;
}

function formatHours(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2).replace(/\.00$/, "");
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

function computeDliMolPerM2Day(ppfd: number, onHours: number): number {
  return (ppfd * onHours * SECONDS_PER_HOUR) / MICROMOLES_PER_MOLE;
}

export function LightingControlCard({
  title = "Lighting controls",
  description,
  measuredPpfd,
  targetPpfd,
  schedule,
  onTargetPpfdChange,
  onScheduleSubmit,
  isScheduleSubmitting = false,
  scheduleMessages,
  scheduleSubmitLabel,
  deviceTiles = [],
  ghostPlaceholders,
  deviceSectionEmptyLabel,
  onGhostAction
}: LightingControlCardProps): ReactElement {
  const targetInputId = useId();
  const scheduleFormTitleId = useId();

  const [targetInput, setTargetInput] = useState(() => targetFormatter.format(targetPpfd));
  const [targetValue, setTargetValue] = useState(targetPpfd);

  useEffect(() => {
    setTargetValue(targetPpfd);
    setTargetInput(targetFormatter.format(targetPpfd));
  }, [targetPpfd]);

  const handleTargetChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setTargetInput(value);
    if (value.trim().length === 0) {
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setTargetValue(parsed);
    onTargetPpfdChange?.(parsed);
  };

  const handleTargetBlur = () => {
    setTargetInput(targetFormatter.format(targetValue));
  };

  const resolvedMessages = useMemo<LightScheduleValidationMessages>(
    () => ({
      ...defaultValidationMessages,
      ...scheduleMessages
    }),
    [scheduleMessages]
  );

  const [scheduleInputs, setScheduleInputs] = useState<ScheduleInputsState>(() => ({
    onHours: formatHours(schedule.onHours),
    offHours: formatHours(schedule.offHours),
    startHour: formatHours(schedule.startHour)
  }));

  useEffect(() => {
    const normalized = normalizeLightSchedule(schedule);
    setScheduleInputs({
      onHours: formatHours(normalized.onHours),
      offHours: formatHours(normalized.offHours),
      startHour: formatHours(normalized.startHour)
    });
  }, [schedule.onHours, schedule.offHours, schedule.startHour]);

  const handleScheduleChange = (field: keyof ScheduleInputsState) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (value.trim().length === 0) {
      setScheduleInputs((previous) => ({
        ...previous,
        [field]: ""
      }));
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const maximum = field === "startHour" ? HOURS_PER_DAY - LIGHT_SCHEDULE_GRID_HOURS : HOURS_PER_DAY;
    const clamped = clamp(parsed, 0, maximum);

    const snapped = snapToGrid(clamped);
    setScheduleInputs((previous) => ({
      ...previous,
      [field]: formatHours(snapped)
    }));
  };

  const validationResult = useMemo(() => {
    return validateLightScheduleInput(
      {
        onHours: parseHours(scheduleInputs.onHours),
        offHours: parseHours(scheduleInputs.offHours),
        startHour: parseHours(scheduleInputs.startHour)
      },
      resolvedMessages
    );
  }, [scheduleInputs.offHours, scheduleInputs.onHours, scheduleInputs.startHour, resolvedMessages]);

  const normalizedSchedule = useMemo(() => normalizeLightSchedule(schedule), [schedule.offHours, schedule.onHours, schedule.startHour]);
  const previewSchedule = validationResult.schedule ?? normalizedSchedule;
  const dliPreview = Number.isFinite(targetValue) ? computeDliMolPerM2Day(targetValue, previewSchedule.onHours) : null;

  const handleScheduleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validationResult.isValid || !validationResult.schedule) {
      return;
    }

    const normalized = validationResult.schedule;
    setScheduleInputs({
      onHours: formatHours(normalized.onHours),
      offHours: formatHours(normalized.offHours),
      startHour: formatHours(normalized.startHour)
    });
    onScheduleSubmit?.(normalized);
  };

  const scheduleErrors = validationResult.errors;
  const activeScheduleStatuses = useMemo(() => {
    const entries = Object.entries(validationResult.status) as [
      keyof LightScheduleValidationStatusMap,
      ValidationStatusDetail
    ][];
    return entries.filter(([, detail]) => detail.status !== "ok");
  }, [validationResult.status]);

  return (
    <ControlCard
      title={title}
      description={description}
      measured={{ label: "Measured PPFD", displayValue: `${targetFormatter.format(measuredPpfd)} µmol`, numericValue: measuredPpfd }}
      target={{ label: copy.targetLabel, displayValue: `${targetFormatter.format(targetValue)} µmol`, numericValue: targetValue }}
      deviceSection={{
        children: deviceTiles.map((tile) => <LightingDeviceTile key={tile.id} {...tile} />),
        ghostPlaceholders,
        emptyLabel: deviceSectionEmptyLabel
      }}
      onGhostAction={onGhostAction}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-2" htmlFor={targetInputId}>
            <span className="text-sm font-medium text-text-primary">{copy.targetLabel}</span>
            <input
              id={targetInputId}
              className="w-32 rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
              inputMode="decimal"
              min={0}
              name="targetPpfd"
              onBlur={handleTargetBlur}
              onChange={handleTargetChange}
              step={25}
              type="number"
              value={targetInput}
            />
            <span className="text-xs text-text-muted">{copy.targetHelp}</span>
          </label>
          <div
            className="inline-flex items-center gap-2 rounded-full border border-accent-primary/50 bg-accent-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-primary"
            aria-label={`${copy.dliLabel}: ${dliPreview === null ? "Unavailable" : dliFormatter.format(dliPreview)} ${copy.dliUnit}`}
          >
            <span>{copy.dliLabel}</span>
            <span className="text-sm normal-case tracking-normal">
              {dliPreview === null ? "--" : `${dliFormatter.format(dliPreview)} ${copy.dliUnit}`}
            </span>
          </div>
        </div>

        <form aria-labelledby={scheduleFormTitleId} className="space-y-4" onSubmit={handleScheduleSubmit}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary" id={scheduleFormTitleId}>
              {copy.scheduleTitle}
            </h3>
            <span className="text-xs uppercase tracking-[0.18em] text-accent-muted">24h total required</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-primary">{en.intents.setLightSchedule.fields.onHours.label}</span>
              <input
                aria-label={en.intents.setLightSchedule.fields.onHours.label}
                className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
                inputMode="decimal"
                min={0}
                max={HOURS_PER_DAY}
                name="onHours"
                onChange={handleScheduleChange("onHours")}
                step={LIGHT_SCHEDULE_GRID_HOURS}
                type="number"
                value={scheduleInputs.onHours}
              />
              <span className="text-xs text-text-muted">{en.intents.setLightSchedule.fields.onHours.help}</span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-primary">{en.intents.setLightSchedule.fields.offHours.label}</span>
              <input
                aria-label={en.intents.setLightSchedule.fields.offHours.label}
                className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
                inputMode="decimal"
                min={0}
                max={HOURS_PER_DAY}
                name="offHours"
                onChange={handleScheduleChange("offHours")}
                step={LIGHT_SCHEDULE_GRID_HOURS}
                type="number"
                value={scheduleInputs.offHours}
              />
              <span className="text-xs text-text-muted">{en.intents.setLightSchedule.fields.offHours.help}</span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-primary">{en.intents.setLightSchedule.fields.startHour.label}</span>
              <input
                aria-label={en.intents.setLightSchedule.fields.startHour.label}
                className="rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-sm text-text-primary"
                inputMode="decimal"
                min={0}
                max={HOURS_PER_DAY}
                name="startHour"
                onChange={handleScheduleChange("startHour")}
                step={LIGHT_SCHEDULE_GRID_HOURS}
                type="number"
                value={scheduleInputs.startHour}
              />
              <span className="text-xs text-text-muted">{en.intents.setLightSchedule.fields.startHour.help}</span>
            </label>
          </div>

          {scheduleErrors.length > 0 ? (
            <div className="rounded-lg border border-border-strong bg-surface-critical/10 p-4" role="alert">
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-critical">
                {scheduleErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeScheduleStatuses.length > 0 ? (
            <ul className="space-y-1" aria-live="polite">
              {activeScheduleStatuses.map(([key, detail]) => (
                <li key={key} className="text-xs text-text-muted" data-status={detail.status}>
                  {detail.message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isScheduleSubmitting || !validationResult.isValid}
              type="submit"
            >
              {isScheduleSubmitting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-flex size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  <span>Saving…</span>
                </>
              ) : (
                scheduleSubmitLabel ?? copy.submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </ControlCard>
  );
}

function LightingDeviceTile({
  name,
  contributionFraction01,
  isEnabled,
  onToggle,
  description
}: LightingDeviceTileProps): ReactElement {
  const contribution = clamp(contributionFraction01, 0, 1);
  const percentLabel = percentFormatter.format(contribution);
  const statusLabel = isEnabled ? copy.statusEnabled : copy.statusDisabled;

  return (
    <div className="flex h-full flex-col justify-between gap-4 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">{name}</p>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent-muted">{statusLabel}</span>
        </div>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
        <span className="inline-flex items-center gap-2 rounded-full border border-border-base/70 bg-canvas-subtle/60 px-3 py-1 text-xs font-semibold text-text-primary">
          {percentLabel} of output
        </span>
      </div>
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition",
          isEnabled
            ? "border-border-strong bg-surface-critical/10 text-text-critical hover:bg-surface-critical/20"
            : "border-accent-primary/60 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
        )}
        onClick={() => {
          onToggle(!isEnabled);
        }}
        aria-pressed={isEnabled}
      >
        {isEnabled ? copy.toggleDisable : copy.toggleEnable}
      </button>
    </div>
  );
}

