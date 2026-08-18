import { describe, it, expect, vi, beforeEach } from "vitest";
import { chainable } from "../helpers/supabase-mock";

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));

const { getDepositTotalCents, getDepositPayments } = await import("@/lib/reservations");

beforeEach(() => {
  fromMock.mockReset();
});

describe("getDepositTotalCents", () => {
  it("sums all deposit payments for a reservation, in cents", async () => {
    fromMock.mockReturnValueOnce(
      chainable({ data: [{ amount_usd: "400.00" }, { amount_usd: "400.00" }], error: null })
    );
    const total = await getDepositTotalCents("resv-1");
    expect(total).toBe(80000);
    expect(fromMock).toHaveBeenCalledWith("reservation_deposit_payments");
  });

  it("returns 0 when no deposits have been paid", async () => {
    fromMock.mockReturnValueOnce(chainable({ data: [], error: null }));
    const total = await getDepositTotalCents("resv-2");
    expect(total).toBe(0);
  });

  it("is scoped to a single reservation id — a cancelled reservation's deposits never leak into a replacement reservation", async () => {
    // A new reservation on the same product gets a brand-new id (the old one
    // is soft-cancelled, never reused), so querying by reservation_id alone
    // is sufficient scoping -- this test documents that assumption.
    const builder = chainable({ data: [{ amount_usd: "400.00" }], error: null });
    fromMock.mockReturnValueOnce(builder);
    await getDepositTotalCents("resv-old-cancelled");
    expect(builder.eq).toHaveBeenCalledWith("reservation_id", "resv-old-cancelled");
  });
});

describe("getDepositPayments", () => {
  it("returns full payment history ordered oldest first", async () => {
    fromMock.mockReturnValueOnce(
      chainable({
        data: [
          { id: "d1", amount_usd: "400.00", paid_at: "2026-01-01T00:00:00Z", stripe_payment_intent_id: "pi_1" },
          { id: "d2", amount_usd: "400.00", paid_at: "2026-02-01T00:00:00Z", stripe_payment_intent_id: "pi_2" },
        ],
        error: null,
      })
    );
    const payments = await getDepositPayments("resv-1");
    expect(payments).toHaveLength(2);
    expect(payments[0]).toEqual({ id: "d1", amountUsd: 400, paidAt: "2026-01-01T00:00:00Z", stripePaymentIntentId: "pi_1" });
  });
});
