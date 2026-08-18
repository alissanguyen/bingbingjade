import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../../helpers/supabase-mock";

// Regression coverage: a reservation can now have any number of deposit
// installments. Idempotency must be per Stripe session (unique on
// reservation_deposit_payments.stripe_checkout_session_id), never a single
// reservation-level "deposit_paid" flag — that flag used to silently drop
// every installment after the first.

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
vi.mock("@/lib/service-requests", () => ({ handleServiceCheckoutCompleted: vi.fn() }));

const { POST } = await import("@/app/api/stripe/webhook/route");

function depositSessionRequest(sessionId: string, reservationId: string, amountTotalCents: number) {
  const event = {
    id: `evt_${sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        created: Math.floor(Date.now() / 1000),
        amount_total: amountTotalCents,
        payment_intent: `pi_${sessionId}`,
        metadata: { is_reservation_deposit: "true", reservation_id: reservationId },
      },
    },
  };
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

beforeEach(() => {
  fromMock.mockReset();
  process.env.NEXT_PUBLIC_CHECKOUT_MODE = "test"; // exercise the non-live JSON-parsing branch
});

describe("webhook — reservation deposit (multi-installment)", () => {
  it("records a new installment when the reservation exists and the session hasn't been recorded yet", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "resv-1" }, error: null })) // product_reservations lookup
      .mockReturnValueOnce(chainable({ data: null, error: null })) // existing deposit-by-session check
      .mockReturnValueOnce(chainable({ data: null, error: null })); // insert

    const res = await POST(depositSessionRequest("cs_deposit_1", "resv-1", 40000));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("reservation_deposit_payments");
  });

  it("is idempotent for a repeat delivery of the same session (no duplicate row)", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "resv-1" }, error: null })) // product_reservations lookup
      .mockReturnValueOnce(chainable({ data: { id: "dep-1" }, error: null })); // existing deposit-by-session check finds it

    const res = await POST(depositSessionRequest("cs_deposit_1", "resv-1", 40000));
    expect(res.status).toBe(200);
    // Only 2 calls: reservation lookup + existing check. No insert call.
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("records a second, independent installment for the same reservation (the exact bug this fixes)", async () => {
    // A 2nd deposit for the same reservation must NOT be short-circuited just
    // because a prior deposit already exists for that reservation -- only an
    // identical session id should be treated as a duplicate.
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "resv-1" }, error: null })) // product_reservations lookup
      .mockReturnValueOnce(chainable({ data: null, error: null })) // existing deposit-by-THIS-session check: none
      .mockReturnValueOnce(chainable({ data: null, error: null })); // insert

    const res = await POST(depositSessionRequest("cs_deposit_2", "resv-1", 40000));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("reservation_deposit_payments");
  });

  it("returns 404 if the reservation no longer exists", async () => {
    fromMock.mockReturnValueOnce(chainable({ data: null, error: null }));

    const res = await POST(depositSessionRequest("cs_deposit_3", "resv-missing", 40000));
    expect(res.status).toBe(404);
  });
});
