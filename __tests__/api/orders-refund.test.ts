import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../helpers/supabase-mock";

// Covers the exact scenario reported: an order paid by a manual method
// (e.g. Zelle) with no Stripe payment_intent, refunded via the admin
// { manual: true } path. The route must still sync order_payments so the
// refund actually stops counting in Full Detailed Accounting.

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));
vi.mock("@/lib/stripe", () => ({ stripe: { refunds: { create: vi.fn() } } }));
vi.mock("@/lib/store-credit", () => ({ restoreStoreCredit: vi.fn() }));

const syncOrderPaymentsRefundStatusMock = vi.fn();
vi.mock("@/lib/orders", () => ({ syncOrderPaymentsRefundStatus: (...args: unknown[]) => syncOrderPaymentsRefundStatusMock(...args) }));

process.env.ADMIN_PASSWORD = "test-admin-password";
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => (name === "admin_session" ? { value: "test-admin-password" } : undefined) }),
}));

const { POST } = await import("@/app/api/admin/orders/[id]/refund/route");

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/refund", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "order-1" }) };

beforeEach(() => {
  fromMock.mockReset();
  syncOrderPaymentsRefundStatusMock.mockReset();
});

describe("POST /api/admin/orders/[id]/refund", () => {
  it("syncs order_payments to refunded for a manual (non-Stripe) refund", async () => {
    fromMock
      .mockReturnValueOnce(
        chainable({
          data: {
            id: "order-1",
            order_number: "BBJ-9999",
            stripe_payment_intent_id: null,
            amount_total: 95000,
            stripe_amount_cents: null,
            store_credit_id: null,
            store_credit_used_cents: 0,
            status: "paid",
          },
          error: null,
        })
      )
      .mockReturnValueOnce(chainable({ data: { id: "order-1", status: "refunded", order_status: "order_cancelled" }, error: null }));

    const res = await POST(makeReq({ manual: true }), ctx);
    expect(res.status).toBe(200);
    expect(syncOrderPaymentsRefundStatusMock).toHaveBeenCalledWith("order-1", false);
  });

  it("does not sync order_payments when the order is already refunded", async () => {
    // Already refunded — route should 409 immediately, before ever calling sync.
    fromMock.mockReturnValueOnce(
      chainable({ data: { id: "order-1", status: "refunded", stripe_payment_intent_id: null, store_credit_used_cents: 0 }, error: null })
    );

    const res = await POST(makeReq({ manual: true }), ctx);
    expect(res.status).toBe(409);
    expect(syncOrderPaymentsRefundStatusMock).not.toHaveBeenCalled();
  });
});
