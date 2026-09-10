/**
 * Format helpers voor het beheerportaal. Worden gebruikt op alle
 * pagina's onder /admin om bedragen en datums consistent weer te
 * geven volgens NL-conventie.
 */

import { formatDistanceStrict } from "date-fns";
import { nl } from "date-fns/locale";

const EURO_FORMATTER = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EURO_PRECISE = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatEuro(
  value: string | number | null | undefined,
  precise = false
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return precise ? EURO_PRECISE.format(n) : EURO_FORMATTER.format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FORMATTER.format(d);
}

export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return DATETIME_FORMATTER.format(d);
}

/**
 * Geeft "over 5 dagen" / "3 weken geleden" / "ongeveer 1 jaar geleden" terug.
 * Schaalt automatisch naar de meest passende eenheid (dagen → weken → maanden → jaren).
 */
export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return formatDistanceStrict(d, now, { addSuffix: true, locale: nl });
}

/**
 * Aantal dagen tot een datum (negatief = verleden). Geeft null als input ongeldig.
 */
export function daysUntil(
  value: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
