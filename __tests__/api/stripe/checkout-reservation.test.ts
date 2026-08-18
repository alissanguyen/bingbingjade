import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../../helpers/supabase-mock";

// Regression coverage: the checkout route used to trust a client-supplied
// reservationDepositAmountCents figure directly (clamped only to >= 0) when
// building the Stripe coupon that discounts a reserved item's final charge.
// A malicious client could claim an arbitrary deposit credit. The route must
// now always re-derive the credit from the reservation's actual recorded
// deposit payments.

const getDepositTotalCentsMock = vi.fn((..._args: unknown[]) => Promise.resolve(80000)); // $800 actually on file
vi.mock("@/lib/reservations", () => ({
  getDepositTotalCents: (...args: unknown[]) => getDepositTotalCentsMock(...args),
}));

vi.mock("@/lib/customer-restrictions", () => ({
  checkCustomerRestriction: vi.fn(() => Promise.resolve({ blocked: false, flagged: false })),
  logBlockedAttempt: vi.fn(),
}));
vi.mock("@/lib/store-credit", () => ({
  validateStoreCredit: vi.fn(),
  reserveStoreCredit: vi.fn(),
  releaseStoreCreditReservation: vi.fn(),
}));
vi.mock("@/lib/orders", () => ({ finalizeProductOrder: vi.fn() }));

const couponsCreateMock = vi.fn((..._args: unknown[]) => Promise.resolve({ id: "coupon_test_1" }));
const sessionsCreateMock = vi.fn((..._args: unknown[]) => Promise.resolve({ id: "cs_test_1", url: "https://checkout.stripe.com/cs_test_1" }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    coupons: { create: (...args: unknown[]) => couponsCreateMock(...args) },
    checkout: { sessions: { create: (...args: unknown[]) => sessionsCreateMock(...args) } },
  },
}));

const RESERVED_PRODUCT = {
  id: "prod-1",
  name: "Test Bangle",
  status: "reserved",
  price_display_usd: 1200,
  sale_price_usd: null,
  public_id: "pub1",
  slug: "test-bangle",
  quick_ship: true,
  reserved_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1hr from now
};

const productsBuilder = chainable({ data: RESERVED_PRODUCT, error: null });
const reservationsBuilder = chainable({ data: { id: "resv-1", expires_at: RESERVED_PRODUCT.reserved_until }, error: null });
const genericBuilder = chainable({ data: null, error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "products") return productsBuilder;
  if (table === "product_reservations") return reservationsBuilder;
  return genericBuilder;
});
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...(args as [string])) },
}));

const { POST } = await import("@/app/api/stripe/checkout/route");

function checkoutRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fromMock.mockClear();
  getDepositTotalCentsMock.mockClear();
  couponsCreateMock.mockClear();
  sessionsCreateMock.mockClear();
  process.env.NEXT_PUBLIC_CHECKOUT_MODE = "live"; // skip the admin-only beta gate
});

describe("POST /api/stripe/checkout — reservation deposit trust boundary", () => {
  it("derives the deposit coupon from the reservation's actual recorded deposits, ignoring any client-supplied amount", async () => {
    const req = checkoutRequest({
      items: [{ productId: "prod-1", productName: "Test Bangle", reservationId: "resv-1" }],
      customerEmail: "buyer@example.com",
      // Even if a client tried to smuggle a bogus figure through, there is no
      // longer any field the server reads for this — reservationDepositAmountCents
      // has been removed from the request shape entirely.
      reservationDepositAmountCents: 999999,
      shippingAddress: {
        name: "Buyer", line1: "123 Main St", city: "Seattle", state: "WA", postal: "98101", country: "US",
      },
    });

    const res = await POST(req);
    const body = await res.json();
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    }

    expect(getDepositTotalCentsMock).toHaveBeenCalledWith("resv-1");
    // The coupon actually created must reflect the $800 on file, never the
    // $999,999 the client claimed.
    expect(couponsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount_off: expect.any(Number) })
    );
    const couponArg = couponsCreateMock.mock.calls[0][0] as { amount_off: number };
    expect(couponArg.amount_off).toBeGreaterThanOrEqual(80000);
    expect(couponArg.amount_off).toBeLessThan(999999);
  });

  it("rejects checkout for a reserved item with no reservationId on the cart item", async () => {
    const req = checkoutRequest({
      items: [{ productId: "prod-1", productName: "Test Bangle" }],
      customerEmail: "buyer@example.com",
      shippingAddress: {
        name: "Buyer", line1: "123 Main St", city: "Seattle", state: "WA", postal: "98101", country: "US",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(getDepositTotalCentsMock).not.toHaveBeenCalled();
  });
});
