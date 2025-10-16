import type { ReactElement } from "react";
import { Pause, Play, StepForward } from "lucide-react";
import { workspaceCopy } from "@ui/design/tokens";
import { cn } from "@ui/lib/cn";
import { formatClockLabel, formatCurrency, formatSignedCurrencyPerHour, useShellLocale } from "@ui/lib/locale";
import { DEFAULT_SIMULATION_CLOCK, deriveSimulationClock } from "@ui/lib/simTime";
import { SIM_SPEED_OPTIONS, useSimulationControls } from "@ui/state/simulationControls";
import { useEconomySnapshot } from "@ui/state/economy";
import { useTelemetryTick } from "@ui/state/telemetry";

export function SimControlBar(): ReactElement {
  const locale = useShellLocale();
  const controls = useSimulationControls();
  const economy = useEconomySnapshot();
  const tickTelemetry = useTelemetryTick();

  const clock = deriveSimulationClock(tickTelemetry?.simTimeHours, DEFAULT_SIMULATION_CLOCK);
  const localeCopy = workspaceCopy.simControlBar.localeLabels[locale];
  const clockLabel = formatClockLabel(clock, locale, { day: localeCopy.day });
  const balanceFormatted = formatCurrency(economy.balance, locale);
  const deltaFormatted = formatSignedCurrencyPerHour(economy.deltaPerHour, locale);

  return (
    <section
      aria-label={workspaceCopy.simControlBar.label}
      className="sticky bottom-4 z-30 flex flex-col gap-4 rounded-2xl border border-border-base bg-canvas-raised/90 p-4 backdrop-blur lg:sticky lg:top-0 lg:bottom-auto"
      data-position-desktop="top"
      data-position-mobile="bottom"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              "border-transparent bg-accent-primary/20 text-text-primary hover:border-accent-primary/60 hover:bg-accent-primary/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
            )}
            aria-pressed={controls.isPlaying}
            onClick={() => {
              if (controls.isPlaying) {
                void controls.requestPause();
              } else {
                void controls.requestPlay();
              }
            }}
          >
            {controls.isPlaying ? (
              <>
                <Pause aria-hidden="true" className="size-4" />
                <span>{workspaceCopy.simControlBar.pause}</span>
              </>
            ) : (
              <>
                <Play aria-hidden="true" className="size-4" />
                <span>{workspaceCopy.simControlBar.play}</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border-base px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
            onClick={() => {
              void controls.requestStep();
            }}
          >
            <StepForward aria-hidden="true" className="size-4" />
            <span>{workspaceCopy.simControlBar.step}</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-accent-muted">
            {workspaceCopy.simControlBar.speedsLabel}
          </span>
          <div className="flex items-center gap-2" role="group" aria-label={workspaceCopy.simControlBar.speedsLabel}>
            {SIM_SPEED_OPTIONS.map((speedOption) => (
              <button
                key={speedOption}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-2 text-sm font-semibold transition",
                  "border-border-base bg-canvas-subtle/70 text-text-muted hover:border-accent-primary/50 hover:bg-canvas-subtle/90 hover:text-text-primary",
                  controls.speed === speedOption &&
                    "border-accent-primary/60 bg-accent-primary/20 text-text-primary"
                )}
                aria-pressed={controls.speed === speedOption}
                onClick={() => {
                  if (controls.speed !== speedOption) {
                    void controls.requestSpeed(speedOption);
                  }
                }}
              >
                {speedOption}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-4 border-t border-border-base pt-4 text-sm">
        <dl className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-[0.3em] text-accent-muted">
            {workspaceCopy.simControlBar.tickClockLabel}
          </dt>
          <dd className="text-base font-semibold text-text-primary">
            {clockLabel.dayLabel} · {clockLabel.time}
          </dd>
        </dl>
        <dl className="flex flex-col gap-1 text-right">
          <dt className="text-xs uppercase tracking-[0.3em] text-accent-muted">
            {workspaceCopy.simControlBar.balanceLabel}
          </dt>
          <dd className="text-base font-semibold text-text-primary">{balanceFormatted}</dd>
        </dl>
        <dl className="flex flex-col gap-1 text-right">
          <dt className="text-xs uppercase tracking-[0.3em] text-accent-muted">
            {workspaceCopy.simControlBar.balanceDeltaLabel}
          </dt>
          <dd className="text-base font-semibold text-text-primary">
            {deltaFormatted} · {localeCopy.deltaSuffix}
          </dd>
        </dl>
      </div>
    </section>
  );
}
