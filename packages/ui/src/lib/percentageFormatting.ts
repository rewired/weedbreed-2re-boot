const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function formatThroughputPercentage(fraction01: number): string {
  return percentFormatter.format(clamp01(fraction01));
}

export function formatCapacityPercentage(fraction01: number): string {
  return percentFormatter.format(clamp01(fraction01));
}
