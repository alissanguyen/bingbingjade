import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../../helpers/supabase-mock";

// Regression coverage for the "Record Payment" admin control — added after
// manually-created orders were found with no way to correct/record a payment
// after the fact (e.g. a $400 deposit that was never logged because of the
// net_received_usd NOT NULL bug in the original create-order insert).

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { GET, POST } = await import("@/app/api/admin/orders/[id]/payments/route");
const { DELETE } = await import("@/app/api/admin/orders/[id]/payments/[paymentId]/route");

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/payments", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const ctx = { params: Promise.resolve({ id: "order-1" }) };
const deleteCtx = { params: Promise.resolve({ id: "order-1", paymentId: "pay-1" }) };

beforeEach(() => {
  fromMock.mockReset();
  mockSession = { type: "admin" };
});

describe("GET /api/admin/orders/[id]/payments", () => {
  it("rejects a non-admin session", async () => {
    mockSession = null;
    const res = await GET(makeReq("GET"), ctx);
    expect(res.status).toBe(401);
  });

  it("lists recorded payments for the order", async () => {
    fromMock.mockReturnValueOnce(chainable({ data: [{ id: "pay-1", amount_paid_usd: 400 }], error: null }));
    const res = await GET(makeReq("GET"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payments).toHaveLength(1);
  });
});

describe("POST /api/admin/orders/[id]/payments", () => {
  it("rejects a non-positive amount", async () => {
    const res = await POST(makeReq("POST", { amountUsd: 0, provider: "zelle" }), ctx);
    expect(res.status).toBe(400);
  });

  it("rejects an invalid provider", async () => {
    const res = await POST(makeReq("POST", { amountUsd: 400, provider: "bogus" }), ctx);
    expect(res.status).toBe(400);
  });

  it("records a payment with net_received_usd set (the exact field the original bug omitted)", async () => {
    const orderLookup = chainable({ data: { order_number: "BBJ-1362", currency: "usd" }, error: null });
    const paymentInsert = chainable({ data: { id: "pay-1", amount_paid_usd: 400 }, error: null });
    fromMock
      .mockReturnValueOnce(orderLookup)
      .mockReturnValueOnce(paymentInsert);

    const res = await POST(makeReq("POST", { amountUsd: 400, provider: "zelle", notes: "deposit" }), ctx);
    expect(res.status).toBe(201);
    expect(paymentInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_paid_usd: 400,
        net_received_usd: 400,
        payment_fee_usd: 0,
        payment_provider: "zelle",
        payment_type: "manual",
        notes: "deposit",
      })
    );
  });
});

describe("DELETE /api/admin/orders/[id]/payments/[paymentId]", () => {
  it("rejects a non-admin session", async () => {
    mockSession = null;
    const res = await DELETE(makeReq("DELETE"), deleteCtx);
    expect(res.status).toBe(401);
  });

  it("deletes the payment row scoped to the order", async () => {
    const builder = chainable({ data: null, error: null });
    fromMock.mockReturnValueOnce(builder);
    const res = await DELETE(makeReq("DELETE"), deleteCtx);
    expect(res.status).toBe(204);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "pay-1");
  });
});
