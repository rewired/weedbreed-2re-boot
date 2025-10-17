import type { SupportedLocale } from "@ui/lib/locale";

const DEFAULT_MAXIMUM_FRACTION_DIGITS = 2;
const ABSOLUTE_MAXIMUM_FRACTION_DIGITS = 3;

export interface RoundingFormatOptions {
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
}

function clampFractionDigits(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value)) {
    return DEFAULT_MAXIMUM_FRACTION_DIGITS;
  }

  const clamped = Math.max(0, Math.min(Math.trunc(value), ABSOLUTE_MAXIMUM_FRACTION_DIGITS));
  return clamped;
}

export function formatRoundedNumber(
  value: number,
  locale: SupportedLocale,
  options: RoundingFormatOptions = {}
): string {
  const minimumFractionDigits = clampFractionDigits(options.minimumFractionDigits);
  const maximumFractionDigits = clampFractionDigits(options.maximumFractionDigits) ?? DEFAULT_MAXIMUM_FRACTION_DIGITS;

  const resolvedMinimum = Math.min(minimumFractionDigits ?? 0, maximumFractionDigits);

  const formatter = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: resolvedMinimum,
    maximumFractionDigits,
    signDisplay: "auto"
  });

  return formatter.format(value);
}
