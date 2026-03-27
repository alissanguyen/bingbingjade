/**
 * Tests for the discount validation engine.
 *
 * All Supabase calls are mocked — this tests the pure logic of
 * discount computation, validation, and abuse prevention.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabase-admin ────────────────────────────────────────────────────────

// vi.mock is hoisted to the top of the file, so we use vi.hoisted() to
// create the mock object before the hoist boundary.
const mockChain = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  is: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  in: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: mockChain,
}));

import {
  computeTieredDiscountCents,
  TIER_HIGH_THRESHOLD_CENTS,
  TIER_HIGH_DISCOUNT_CENTS,
  TIER_LOW_DISCOUNT_CENTS,
  validateDiscount,
  commitDiscount,
  processReferralRewardOnDelivery,
  generateReferralCode,
  normalizeEmail,
} from "@/lib/discount";

// ── Shared mock helpers ────────────────────────────────────────────────────────

/**
 * Reset all mocks before each test:
 * - Clear call history and any queued Once values
 * - Chain methods return mockChain (so calls can be chained)
 * - Terminal methods resolve to { data: null, error: null } by default
 */
function resetMocks() {
  vi.clearAllMocks();

  // All chain methods return mockChain so callers can keep chaining
  mockChain.from.mockReturnValue(mockChain);
  mockChain.select.mockReturnValue(mockChain);
  mockChain.insert.mockReturnValue(mockChain);
  mockChain.update.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.neq.mockReturnValue(mockChain);
  mockChain.is.mockReturnValue(mockChain);
  mockChain.in.mockReturnValue(mockChain);

  // Terminal methods resolve to null by default (safe no-op)
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockChain.single.mockResolvedValue({ data: null, error: null });
}

// ── computeTieredDiscountCents ─────────────────────────────────────────────────

describe("computeTieredDiscountCents", () => {
  it("returns $10 for subtotals below $150", () => {
    expect(computeTieredDiscountCents(14900)).toBe(TIER_LOW_DISCOUNT_CENTS); // $149
    expect(computeTieredDiscountCents(1000)).toBe(TIER_LOW_DISCOUNT_CENTS);
    expect(computeTieredDiscountCents(14999)).toBe(TIER_LOW_DISCOUNT_CENTS);
  });

  it("returns $20 for subtotals at exactly $150", () => {
    expect(computeTieredDiscountCents(15000)).toBe(TIER_HIGH_DISCOUNT_CENTS);
  });

  it("returns $20 for subtotals above $150", () => {
    expect(computeTieredDiscountCents(15001)).toBe(TIER_HIGH_DISCOUNT_CENTS);
    expect(computeTieredDiscountCents(50000)).toBe(TIER_HIGH_DISCOUNT_CENTS);
  });

  it("tier thresholds are correct constants", () => {
    expect(TIER_HIGH_THRESHOLD_CENTS).toBe(15000);
    expect(TIER_HIGH_DISCOUNT_CENTS).toBe(2000);
    expect(TIER_LOW_DISCOUNT_CENTS).toBe(1000);
  });
});

// ── Tiered discount upgrade/downgrade ─────────────────────────────────────────

describe("tiered discount upgrade/downgrade", () => {
  it("upgrades from $10 to $20 when subtotal reaches the threshold", () => {
    expect(computeTieredDiscountCents(14999)).toBe(1000); // just below → $10
    expect(computeTieredDiscountCents(15000)).toBe(2000); // at threshold → $20
  });

  it("downgrades from $20 to $10 when subtotal drops below the threshold", () => {
    expect(computeTieredDiscountCents(15001)).toBe(2000); // above → $20
    expect(computeTieredDiscountCents(14999)).toBe(1000); // drops below → $10
  });
});

// ── normalizeEmail ─────────────────────────────────────────────────────────────

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    expect(normalizeEmail("HELLO@WORLD.IO")).toBe("hello@world.io");
  });
});

// ── generateReferralCode ───────────────────────────────────────────────────────

describe("generateReferralCode", () => {
  it("generates an 8-character code", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it("only uses allowed characters (no 0, 1, O, I, L)", () => {
    const forbidden = /[01OIL]/;
    for (let i = 0; i < 20; i++) {
      expect(generateReferralCode()).not.toMatch(forbidden);
    }
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ── validateDiscount — welcome flow ───────────────────────────────────────────
//
// Call order when no discount code is provided:
//   1. validateStoreCreditDiscount → maybySingle (customers table)
//   2. validateWelcomeDiscount     → maybySingle (email_subscribers table)
//   3. validateWelcomeDiscount     → maybySingle (customers table, paid_order_count check)

describe("validateDiscount — welcome discount", () => {
  beforeEach(resetMocks);

  it("grants $10 when subtotal is $149 and no prior orders", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })         // (1) no store credit
      .mockResolvedValueOnce({                                     // (2) subscribed, not redeemed
        data: { id: "sub-1", welcome_discount_redeemed_at: null },
        error: null,
      });
    // (3) customer check uses default → null (no customer record) → pass

    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.source).toBe("welcome");
      expect(result.discountAmountCents).toBe(1000);
      expect(result.displayMessage).toContain("$10");
    }
  });

  it("grants $20 when subtotal is $150 and no prior orders", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: "sub-1", welcome_discount_redeemed_at: null },
        error: null,
      });

    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      subtotalCents: 15000,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.discountAmountCents).toBe(2000);
      expect(result.displayMessage).toContain("$20");
    }
  });

  it("blocks if welcome discount already redeemed on subscriber record", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })  // (1) no store credit
      .mockResolvedValueOnce({                              // (2) already redeemed
        data: { id: "sub-1", welcome_discount_redeemed_at: "2025-01-01T00:00:00Z" },
        error: null,
      });

    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("already been used");
    }
  });

  it("blocks returning customers (paid_order_count > 0)", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })  // (1) no store credit
      .mockResolvedValueOnce({                              // (2) subscribed, not redeemed
        data: { id: "sub-1", welcome_discount_redeemed_at: null },
        error: null,
      })
      .mockResolvedValueOnce({                              // (3) customer has paid orders
        data: { id: "cust-1", paid_order_count: 2, welcome_discount_redeemed_at: null },
        error: null,
      });

    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("first-time customers");
    }
  });

  it("returns invalid for non-subscribers (no explicit code)", async () => {
    // Both credit and subscriber checks return null (defaults)
    const result = await validateDiscount({
      customerEmail: "nobody@test.com",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
  });
});

// ── validateDiscount — referral flow ──────────────────────────────────────────
//
// When a code is provided, the call order in validateReferralDiscount is:
//   1. maybySingle (customers by referral_code)
//   2. maybySingle (customers by referred email — paid_order_count)
//   3. maybySingle (referrals table — existing referral check)
//
// NOTE: validateDiscount always falls through to validateCampaignDiscount if
// validateReferralDiscount returns invalid. Campaign uses its own maybySingle
// call, which resolves to null by default → "Invalid discount code."
// Tests for referral blocking therefore only assert result.valid === false.

describe("validateDiscount — referral discount", () => {
  beforeEach(resetMocks);

  it("grants referral discount for a new customer using a valid code", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({  // (1) referrer lookup
        data: { id: "referrer-1", customer_email: "referrer@test.com", referral_code: "ABCD1234" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null })  // (2) referred: new customer
      .mockResolvedValueOnce({ data: null, error: null }); // (3) no existing referral

    const result = await validateDiscount({
      customerEmail: "new@test.com",
      discountCode: "ABCD1234",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.source).toBe("referral");
      expect(result.discountAmountCents).toBe(1000);
      expect(result.referrerCustomerId).toBe("referrer-1");
    }
  });

  it("blocks self-referral (result is invalid)", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({  // (1) referrer = same email as buyer
      data: { id: "cust-1", customer_email: "user@test.com", referral_code: "SELFREF1" },
      error: null,
    });
    // Falls through to campaign lookup → default null → "Invalid discount code."

    const result = await validateDiscount({
      customerEmail: "user@test.com",
      discountCode: "SELFREF1",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
  });

  it("blocks referral for returning customers (result is invalid)", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({  // (1) referrer found
        data: { id: "ref-1", customer_email: "referrer@test.com", referral_code: "REFCODE1" },
        error: null,
      })
      .mockResolvedValueOnce({  // (2) referred customer has paid orders → blocked
        data: { id: "existing-cust", paid_order_count: 3 },
        error: null,
      });

    const result = await validateDiscount({
      customerEmail: "returning@test.com",
      discountCode: "REFCODE1",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
  });

  it("blocks duplicate referral use for same code + email (result is invalid)", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({  // (1) referrer found
        data: { id: "ref-1", customer_email: "referrer@test.com", referral_code: "DUPREF12" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null })  // (2) new customer
      .mockResolvedValueOnce({                              // (3) existing active referral found
        data: { id: "existing-referral", status: "pending" },
        error: null,
      });

    const result = await validateDiscount({
      customerEmail: "new@test.com",
      discountCode: "DUPREF12",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
  });

  it("returns invalid when code is not a referral code and not a campaign code", async () => {
    // Referral lookup: not found; campaign lookup: not found (both default to null)
    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      discountCode: "BADCODE",
      subtotalCents: 14900,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Invalid discount code");
    }
  });
});

// ── validateDiscount — no stacking ────────────────────────────────────────────

describe("validateDiscount — no stacking (single discount per checkout)", () => {
  beforeEach(resetMocks);

  it("when a referral code is provided, only referral/campaign paths run (not welcome)", async () => {
    mockChain.maybeSingle
      .mockResolvedValueOnce({  // referrer found
        data: { id: "ref-1", customer_email: "referrer@test.com", referral_code: "REFCODE2" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null })  // new customer
      .mockResolvedValueOnce({ data: null, error: null }); // no existing referral

    const result = await validateDiscount({
      customerEmail: "subscriber@test.com",
      discountCode: "REFCODE2",
      subtotalCents: 14900,
    });

    // Exactly one discount source — referral
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.source).toBe("referral");
      expect(result.discountAmountCents).toBe(1000);
    }
  });

  it("auto-applies store credit (not welcome) when no code and credit balance exists", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({  // customer has credit
      data: { id: "cust-1", store_credit_balance: 15.0 },
      error: null,
    });

    const result = await validateDiscount({
      customerEmail: "loyal@test.com",
      subtotalCents: 20000,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.source).toBe("store_credit");
      expect(result.discountAmountCents).toBe(1500); // $15 in cents
    }
  });
});

// ── validateDiscount — empty cart guard ───────────────────────────────────────

describe("validateDiscount — empty cart guard", () => {
  beforeEach(resetMocks);

  it("returns invalid for zero subtotal", async () => {
    const result = await validateDiscount({
      customerEmail: "buyer@test.com",
      subtotalCents: 0,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("empty");
    }
  });
});

// ── commitDiscount ─────────────────────────────────────────────────────────────

describe("commitDiscount", () => {
  beforeEach(resetMocks);

  it("marks welcome discount as redeemed on subscriber and customer", async () => {
    await commitDiscount({
      source: "welcome",
      customerEmail: "buyer@test.com",
      customerId: "cust-abc",
      orderId: "order-123",
      discountAmountCents: 1000,
    });

    // Should update subscriber + customer (2 calls)
    expect(mockChain.update).toHaveBeenCalledTimes(2);
  });

  it("uses .is(null) guard for welcome discount idempotency", async () => {
    await commitDiscount({
      source: "welcome",
      customerEmail: "buyer@test.com",
      customerId: "cust-abc",
      orderId: "order-123",
      discountAmountCents: 1000,
    });

    expect(mockChain.is).toHaveBeenCalledWith("welcome_discount_redeemed_at", null);
  });

  it("inserts a coupon_redemption record for campaign discounts", async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: "redemption-1" }, error: null });

    const result = await commitDiscount({
      source: "campaign",
      customerEmail: "buyer@test.com",
      customerId: "cust-abc",
      orderId: "order-123",
      discountAmountCents: 1000,
      campaignId: "camp-xyz",
    });

    expect(mockChain.insert).toHaveBeenCalled();
    expect(result.couponRedemptionId).toBe("redemption-1");
  });

  it("inserts a referral record for referral discounts", async () => {
    mockChain.single.mockResolvedValueOnce({ data: { id: "referral-1" }, error: null });

    const result = await commitDiscount({
      source: "referral",
      customerEmail: "new@test.com",
      customerId: "cust-new",
      orderId: "order-456",
      discountAmountCents: 1000,
      referrerCustomerId: "referrer-1",
      referralCode: "ABCD1234",
    });

    expect(mockChain.insert).toHaveBeenCalled();
    expect(result.referralId).toBe("referral-1");
  });

  it("returns empty object for store_credit (no additional DB write at commit time)", async () => {
    const result = await commitDiscount({
      source: "store_credit",
      customerEmail: "loyal@test.com",
      customerId: "cust-1",
      orderId: "order-789",
      discountAmountCents: 1500,
    });

    expect(result).toEqual({});
  });

  it("is idempotent for welcome — calling twice does not error (filter prevents double-write)", async () => {
    // Both calls should succeed without throwing
    await expect(
      commitDiscount({
        source: "welcome",
        customerEmail: "buyer@test.com",
        customerId: "cust-abc",
        orderId: "order-123",
        discountAmountCents: 1000,
      })
    ).resolves.toEqual({});

    await expect(
      commitDiscount({
        source: "welcome",
        customerEmail: "buyer@test.com",
        customerId: "cust-abc",
        orderId: "order-123",
        discountAmountCents: 1000,
      })
    ).resolves.toEqual({});
  });
});

// ── processReferralRewardOnDelivery ───────────────────────────────────────────

describe("processReferralRewardOnDelivery", () => {
  beforeEach(resetMocks);

  it("issues $10 credit to referrer and returns their customerId", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({  // referral lookup
      data: {
        id: "ref-1",
        status: "pending",
        referrer_customer_id: "referrer-1",
        discount_amount_cents: 1000,
      },
      error: null,
    });
    mockChain.single.mockResolvedValueOnce({  // referrer customer lookup
      data: { id: "referrer-1", store_credit_balance: 0 },
      error: null,
    });

    const result = await processReferralRewardOnDelivery("order-123", "ref-1");

    expect(result).toBe("referrer-1");
    expect(mockChain.insert).toHaveBeenCalled(); // store_credit_ledger entry
    expect(mockChain.update).toHaveBeenCalled(); // balance + referral status update
  });

  it("is idempotent — does not issue reward if already rewarded", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "ref-1",
        status: "rewarded",  // already processed
        referrer_customer_id: "referrer-1",
        discount_amount_cents: 1000,
      },
      error: null,
    });

    const result = await processReferralRewardOnDelivery("order-123", "ref-1");

    expect(result).toBeNull();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it("referral reward is issued exactly once (second call is a no-op)", async () => {
    // First call: pending → issues reward
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { id: "ref-1", status: "pending", referrer_customer_id: "ref-cust", discount_amount_cents: 1000 },
      error: null,
    });
    mockChain.single.mockResolvedValueOnce({
      data: { id: "ref-cust", store_credit_balance: 0 },
      error: null,
    });

    const first = await processReferralRewardOnDelivery("order-1", "ref-1");
    expect(first).toBe("ref-cust");
    expect(mockChain.insert).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    // Re-setup chain after clearAllMocks
    mockChain.from.mockReturnValue(mockChain);
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    mockChain.in.mockReturnValue(mockChain);
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockChain.single.mockResolvedValue({ data: null, error: null });

    // Second call: already rewarded → no-op
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: { id: "ref-1", status: "rewarded", referrer_customer_id: "ref-cust", discount_amount_cents: 1000 },
      error: null,
    });

    const second = await processReferralRewardOnDelivery("order-1", "ref-1");
    expect(second).toBeNull();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it("does not issue reward for cancelled referrals", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "ref-1",
        status: "cancelled",
        referrer_customer_id: "referrer-1",
        discount_amount_cents: 1000,
      },
      error: null,
    });

    const result = await processReferralRewardOnDelivery("order-123", "ref-1");

    expect(result).toBeNull();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it("returns null if referral record does not exist", async () => {
    // Default: maybySingle resolves to { data: null }
    const result = await processReferralRewardOnDelivery("order-999", "ref-missing");

    expect(result).toBeNull();
  });
});
