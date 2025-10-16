import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";

export const SUPPORTED_LOCALES = ["en-US", "de-DE"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const MINUTES_PER_HOUR = 60;

function normaliseLocale(candidate: string | undefined): SupportedLocale {
  if (!candidate) {
    return "en-US";
  }

  const lowerCased = candidate.toLowerCase();

  if (lowerCased.startsWith("de")) {
    return "de-DE";
  }

  return "en-US";
}

function resolvePreferredLocale(): string | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  const languageCandidates = navigator.languages;

  if (Array.isArray(languageCandidates) && languageCandidates.length > 0) {
    const candidates = languageCandidates as readonly string[];
    const firstCandidate = candidates[0];

    if (typeof firstCandidate === "string") {
      return firstCandidate;
    }
  }

  const fallbackLanguage = typeof navigator.language === "string" ? navigator.language : undefined;

  return fallbackLanguage;
}

export function useShellLocale(): SupportedLocale {
  return normaliseLocale(resolvePreferredLocale());
}

export function formatCurrency(value: number, locale: SupportedLocale): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "auto"
  });

  return formatter.format(value);
}

export function formatSignedCurrencyPerHour(value: number, locale: SupportedLocale): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "always"
  });

  return formatter.format(value);
}

export interface SimulationClockLabel {
  readonly dayLabel: string;
  readonly time: string;
}

export function formatClockLabel(
  clock: { readonly day: number; readonly hour: number; readonly minute: number },
  locale: SupportedLocale,
  copy: { readonly day: string }
): SimulationClockLabel {
  const clampedHour = Math.max(0, Math.min(HOURS_PER_DAY - 1, clock.hour));
  const clampedMinute = Math.max(0, Math.min(MINUTES_PER_HOUR - 1, clock.minute));
  const hour = String(clampedHour).padStart(2, "0");
  const minute = String(clampedMinute).padStart(2, "0");

  const dayFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

  return {
    dayLabel: `${copy.day} ${dayFormatter.format(clock.day)}`,
    time: `${hour}:${minute}`
  };
}
