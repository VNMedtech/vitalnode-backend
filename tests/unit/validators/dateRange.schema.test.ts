import { describe, expect, it } from "vitest";
import {
  isoDateFromSchema,
  isoDateToSchema,
  parseQueryDateBound,
} from "../../../src/shared/validators/dateRange.schema.js";
import { platformSalesReportQuerySchema } from "../../../src/modules/sales-reports/validators/query.schema.js";

describe("parseQueryDateBound", () => {
  it("expands date-only from to start of UTC day", () => {
    const date = parseQueryDateBound("2026-07-15", "start");
    expect(date.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("expands date-only to to end of UTC day", () => {
    const date = parseQueryDateBound("2026-07-15", "end");
    expect(date.toISOString()).toBe("2026-07-15T23:59:59.999Z");
  });

  it("preserves exact ISO datetime instants", () => {
    const value = "2026-07-15T14:30:00.000+05:30";
    expect(parseQueryDateBound(value, "start").toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
    expect(parseQueryDateBound(value, "end").toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
  });
});

describe("iso date schemas", () => {
  it("parses from/to date-only bounds inclusively for the same calendar day", () => {
    const from = isoDateFromSchema.parse("2026-07-15");
    const to = isoDateToSchema.parse("2026-07-15");
    expect(from.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-15T23:59:59.999Z");
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });
});

describe("platformSalesReportQuerySchema date-only range", () => {
  it("includes a late-day IST instant inside to=YYYY-MM-DD", () => {
    const parsed = platformSalesReportQuerySchema.parse({
      from: "2026-07-09",
      to: "2026-07-15",
    });

    expect(parsed.from?.toISOString()).toBe("2026-07-09T00:00:00.000Z");
    expect(parsed.to?.toISOString()).toBe("2026-07-15T23:59:59.999Z");

    const afternoonIst = new Date("2026-07-15T14:43:00+05:30");
    expect(afternoonIst.getTime()).toBeGreaterThanOrEqual(parsed.from!.getTime());
    expect(afternoonIst.getTime()).toBeLessThanOrEqual(parsed.to!.getTime());
  });
});
