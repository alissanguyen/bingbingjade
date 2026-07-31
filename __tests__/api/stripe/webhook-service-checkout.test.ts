import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../../helpers/supabase-mock";

// Regression test for order #1330-3268: a Stripe checkout session for a
// service request must be routed to handleServiceCheckoutCompleted, never
// fall through to the generic product-order path (which expects items_N
// cart metadata service checkouts never set, and used to 400 out before any
// record was ever created).

const handleServiceCheckoutCompletedMock = vi.fn();
vi.mock("@/lib/service-requests", () => ({
  handleServiceCheckoutCompleted: (...args: unknown[]) => handleServiceCheckoutCompletedMock(...args),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() }, checkout: { sessions: { retrieve: vi.fn(), listLineItems: vi.fn() } }, paymentIntents: { retrieve: vi.fn() } },
  webhookSecret: "whsec_test",
}));

vi.mock("@/lib/orders", () => ({
  upsertCustomer: vi.fn(),
  saveShippingAddress: vi.fn(),
  generateOrderNumber: vi.fn(),
  createShipmentsForOrder: vi.fn(),
  recordOrderPayment: vi.fn(),
  finalizeProductOrder: vi.fn(),
}));
vi.mock("@/lib/discount", () => ({ normalizeEmail: (e: string) => e }));
vi.mock("@/lib/sourcing-classification", () => ({ CREDIT_VALIDITY_DAYS: 30 }));
vi.mock("@/lib/sourcing-emails", () => ({ sendDepositConfirmationEmail: vi.fn() }));
vi.mock("@/lib/shipping", () => ({ MANUAL_CAPTURE_WINDOW_DAYS: { card: 7 } }));
vi.mock("@/lib/store-credit", () => ({ releaseStoreCreditReservation: vi.fn() }));

const { POST } = await import("@/app/api/stripe/webhook/route");

function eventRequest(session: Record<string, unknown>) {
  const event = {
    id: "evt_test_1",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", metadata: {}, ...session } },
  };
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

beforeEach(() => {
  handleServiceCheckoutCompletedMock.mockReset();
  fromMock.mockReset();
  process.env.NEXT_PUBLIC_CHECKOUT_MODE = "test"; // exercise the non-live JSON-parsing branch
});

describe("webhook routing — is_service_checkout", () => {
  it("routes a service-checkout session to handleServiceCheckoutCompleted, never touching the generic order path", async () => {
    handleServiceCheckoutCompletedMock.mockResolvedValue(undefined);

    const req = eventRequest({ metadata: { is_service_checkout: "true", service_request_id: "sr-1", capture_mode: "manual" } });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(handleServiceCheckoutCompletedMock).toHaveBeenCalledTimes(1);
    // The generic product path's idempotency lookup (`supabaseAdmin.from("orders")...`)
    // must never run for a service checkout — this is exactly the bug that
    // dropped order #1330-3268.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 500 (not a silent success) if service-request processing throws", async () => {
    handleServiceCheckoutCompletedMock.mockRejectedValue(new Error("db unavailable"));

    const req = eventRequest({ metadata: { is_service_checkout: "true", service_request_id: "sr-1", capture_mode: "manual" } });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("still 400s a session with no recognized routing flag and no cart items (documents the original failure mode)", async () => {
    // No prior order exists (idempotency lookup returns nothing), and there
    // are no items_N keys — this is the exact metadata shape the old
    // restoration checkout sent, which is why it always fell into this dead end.
    fromMock.mockReturnValue(chainable({ data: null, error: null }));

    const req = eventRequest({ metadata: { service_type: "polishing" } });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(handleServiceCheckoutCompletedMock).not.toHaveBeenCalled();
  });
});
