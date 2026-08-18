import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { chainable } from "../helpers/supabase-mock";

// Regression coverage for the accounting fix: a finalized order funded partly
// by reservation deposits must record its TRUE full sale price on
// orders.amount_total (not just what Stripe charged today), and must
// backfill order_payments with each historical deposit so Cash Received
// reflects every dollar actually collected for the sale.

const depositPayments = [
  { id: "dep-1", amountUsd: 400, paidAt: "2026-01-01T00:00:00Z", stripePaymentIntentId: "pi_dep_1" },
  { id: "dep-2", amountUsd: 400, paidAt: "2026-02-01T00:00:00Z", stripePaymentIntentId: "pi_dep_2" },
];
const getDepositPaymentsMock = vi.fn((..._args: unknown[]) => Promise.resolve(depositPayments));
vi.mock("@/lib/reservations", () => ({
  getDepositPayments: (...args: unknown[]) => getDepositPaymentsMock(...args),
}));

vi.mock("@/lib/stripe", () => ({ stripe: { paymentIntents: { retrieve: vi.fn() } } }));
vi.mock("@/lib/discount", () => ({ commitDiscount: vi.fn(), buildShippingFingerprint: vi.fn() }));
vi.mock("@/lib/storage", () => ({ resolveFirstImageUrl: vi.fn() }));

const ordersBuilder = chainable({ data: { id: "order-1" }, error: null });
const orderPaymentsBuilder = chainable({ data: null, error: null }); // "not found" for existence checks; bare-await insert also resolves fine
const reservationsBuilder = chainable({ data: null, error: null });
const genericBuilder = chainable({ data: null, error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "orders") return ordersBuilder;
  if (table === "order_payments") return orderPaymentsBuilder;
  if (table === "product_reservations") return reservationsBuilder;
  return genericBuilder;
});
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...(args as [string])),
    rpc: () => Promise.resolve({ data: "BBJ-9001", error: null }),
  },
}));

const { finalizeProductOrder } = await import("@/lib/orders");

const baseParams = {
  stripeSessionId: "cs_final_1",
  stripePaymentIntentId: "pi_final_1",
  stripeCustomerId: null,
  currency: "usd",
  paymentIsPaid: true,
  customerEmail: null, // skips customer upsert / shipping-address / email side effects entirely
  resolvedCustomerName: null,
  customerPhone: null,
  resolvedAddr: null,
  metaItems: [{ productId: "prod-1", optionId: null, price: 400 }],
  productNameMap: new Map([["prod-1", "Test Bangle"]]),
  optionLabelMap: new Map(),
  cogsCents: 0,
  feeBreakdown: null,
  discountMeta: null,
  shippingInsuranceAccepted: false,
  shippingInsuranceDeclinedAcknowledged: false,
  merchandiseSubtotalCents: 120000,
  isManualCapture: true, // skips shipment creation — irrelevant to this test
  capturePaymentMethod: null,
  latestStripeStatus: null,
  authorizationExpiresAt: null,
  sourcingRequestId: null,
  sourcingCreditAppliedCents: 0,
  storeCreditId: null,
  storeCreditUsedCents: 0,
  storeCreditReservationRef: null,
  stripeAmountCents: 0, // skips recordOrderPayment's balance-charge path — out of scope for this test
};

beforeEach(() => {
  fromMock.mockClear();
  getDepositPaymentsMock.mockClear();
  (ordersBuilder.insert as Mock).mockClear();
  (orderPaymentsBuilder.insert as Mock).mockClear();
  (reservationsBuilder.update as Mock).mockClear();
});

describe("finalizeProductOrder — reservation deposit accounting", () => {
  it("records the TRUE full sale price on amount_total (caller already adds the deposit credit back in)", async () => {
    await finalizeProductOrder({
      ...baseParams,
      amountTotalCents: 120000, // $1200 -- the full price, deposit credit already added back by the caller
      reservationId: "resv-1",
      reservationDepositCreditCents: 80000, // $800 across the two deposits above
    });

    expect(ordersBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_total: 120000,
        reservation_id: "resv-1",
        reservation_deposit_credit_cents: 80000,
      })
    );
  });

  it("backfills one order_payments row per historical deposit, with its real paid date and payment_intent id", async () => {
    await finalizeProductOrder({
      ...baseParams,
      amountTotalCents: 120000,
      reservationId: "resv-1",
      reservationDepositCreditCents: 80000,
    });

    expect(getDepositPaymentsMock).toHaveBeenCalledWith("resv-1");
    expect(orderPaymentsBuilder.insert).toHaveBeenCalledTimes(2);
    expect(orderPaymentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "order-1",
        payment_type: "deposit",
        provider_transaction_id: "pi_dep_1",
        amount_paid_usd: 400,
        payment_date: "2026-01-01T00:00:00Z",
      })
    );
    expect(orderPaymentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_transaction_id: "pi_dep_2",
        amount_paid_usd: 400,
        payment_date: "2026-02-01T00:00:00Z",
      })
    );
  });

  it("marks the reservation converted to this order", async () => {
    await finalizeProductOrder({
      ...baseParams,
      amountTotalCents: 120000,
      reservationId: "resv-1",
      reservationDepositCreditCents: 80000,
    });

    expect(reservationsBuilder.update).toHaveBeenCalledWith({ converted_order_id: "order-1" });
  });

  it("skips deposit backfill entirely for a normal (non-reservation) order", async () => {
    await finalizeProductOrder({
      ...baseParams,
      amountTotalCents: 40000,
      reservationId: null,
      reservationDepositCreditCents: 0,
    });

    expect(getDepositPaymentsMock).not.toHaveBeenCalled();
    expect(orderPaymentsBuilder.insert).not.toHaveBeenCalled();
  });
});
