import { Prisma } from "../../../generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import { calculateCommissionBreakdown } from "../../../src/modules/settlements/utils/commission.util.js";

describe("Commission calculation", () => {
  it("calculates commission and seller receivable from gross amount", () => {
    const result = calculateCommissionBreakdown(
      new Prisma.Decimal("1000.00"),
      new Prisma.Decimal("10"),
    );

    expect(result.grossAmount.toString()).toBe("1000");
    expect(result.commissionAmount.toString()).toBe("100");
    expect(result.sellerReceivableAmount.toString()).toBe("900");
  });

  it("rounds commission to two decimal places", () => {
    const result = calculateCommissionBreakdown(
      new Prisma.Decimal("99.99"),
      new Prisma.Decimal("12.5"),
    );

    expect(result.commissionAmount.toString()).toBe("12.5");
    expect(result.sellerReceivableAmount.toString()).toBe("87.49");
  });
});
