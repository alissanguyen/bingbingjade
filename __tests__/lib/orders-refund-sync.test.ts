import { describe, it, expect, vi, beforeEach } from "vitest";
import { chainable } from "../helpers/supabase-mock";

// Regression coverage for the bug where order_payments rows stay
// payment_status='paid' forever after an order is refunded/cancelled --
// which is exactly what Full Detailed Accounting's Cash Received /
// Net Cash Received figures are summed from (they never join back to
// orders.status/order_status at all).

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));
vi.mock("@/lib/stripe", () => ({ stripe: {} }));

const { syncOrderPaymentsRefundStatus } = await import("@/lib/orders");

beforeEach(() => {
  fromMock.mockReset();
});

describe("syncOrderPaymentsRefundStatus", () => {
  it("marks payments refunded for a full refund", async () => {
    const builder = chainable({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await syncOrderPaymentsRefundStatus("order-1", false);

    expect(fromMock).toHaveBeenCalledWith("order_payments");
    expect(builder.update).toHaveBeenCalledWith({ payment_status: "refunded" });
    expect(builder.eq).toHaveBeenCalledWith("order_id", "order-1");
    expect(builder.in).toHaveBeenCalledWith("payment_status", ["paid", "partially_refunded"]);
  });

  it("marks payments partially_refunded for a partial refund", async () => {
    const builder = chainable({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await syncOrderPaymentsRefundStatus("order-2", true);

    expect(builder.update).toHaveBeenCalledWith({ payment_status: "partially_refunded" });
  });

  it("never throws even if the update fails (non-fatal by design)", async () => {
    fromMock.mockImplementation(() => { throw new Error("db unavailable"); });
    await expect(syncOrderPaymentsRefundStatus("order-3", false)).resolves.toBeUndefined();
  });
});
