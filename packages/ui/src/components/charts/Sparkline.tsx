import type { ReactElement } from "react";

export interface SparklineProps {
  readonly data: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly title: string;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;

export function Sparkline({ data, min, max, title }: SparklineProps): ReactElement {
  if (data.length === 0 || !Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return (
      <div className="h-16 w-full rounded-md border border-dashed border-border-base/60" aria-label={title} />
    );
  }

  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * VIEWBOX_WIDTH;
      const normalized = (value - min) / (max - min);
      const y = VIEWBOX_HEIGHT - normalized * VIEWBOX_HEIGHT;
      const clampedY = Math.max(0, Math.min(VIEWBOX_HEIGHT, y));
      return `${x.toFixed(2)},${clampedY.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      role="img"
      aria-label={title}
      data-testid="sparkline-chart"
      viewBox={`0 0 ${VIEWBOX_WIDTH.toString()} ${VIEWBOX_HEIGHT.toString()}`}
      className="h-16 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        points={points}
        className="text-accent-primary"
      />
    </svg>
  );
}

