import { z } from "zod";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses API date query values.
 * - Full ISO datetimes keep their exact instant.
 * - Date-only `YYYY-MM-DD` values are treated as inclusive UTC day bounds
 *   (`from` → 00:00:00.000Z, `to` → 23:59:59.999Z) so calendar-day filters
 *   do not truncate most of the end day.
 */
export function parseQueryDateBound(
  value: string,
  bound: "start" | "end",
): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) {
      throw new Error("Invalid date");
    }
    if (bound === "start") {
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date;
}

const isoDateInput = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(DATE_ONLY_RE));

export const isoDateFromSchema = isoDateInput.transform((value) =>
  parseQueryDateBound(value, "start"),
);

export const isoDateToSchema = isoDateInput.transform((value) =>
  parseQueryDateBound(value, "end"),
);
