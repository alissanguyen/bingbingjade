/**
 * Tests for the store-credit system (lib/store-credit.ts).
 *
 * All Supabase calls (including .rpc()) are mocked — this tests the pure
 * validation logic, the condition-wording formatter, and that the
 * reservation/redemption/restoration wrappers call the correct RPC with the
 * correct arguments. Real atomicity (SELECT ... FOR UPDATE inside the RPC
 * functions defined in supabase/migration_102.sql) is a Postgres-level
 * guarantee that isn't exercised through this mock — these tests verify the
 * application-level contract with that RPC boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChain = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: mockChain,
}));

import {
  validateStoreCredit,
  getStoreCreditDisplayConditions,
  reserveStoreCredit,
  releaseStoreCreditReservation,
  redeemStoreCreditReservation,
  restoreStoreCredit,
  adjustStoreCreditBalance,
  normalizeEmail,
  generateStoreCreditCodeCandidate,
  type StoreCreditRow,
} from "@/lib/store-credit";

function resetMocks() {
  vi.clearAllMocks();
  mockChain.from.mockReturnValue(mockChain);
  mockChain.select.mockReturnValue(mockChain);
  mockChain.insert.mockReturnValue(mockChain);
  mockChain.update.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.in.mockReturnValue(mockChain);
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockChain.single.mockResolvedValue({ data: null, error: null });
  mockChain.rpc.mockResolvedValue({ data: null, error: null });
}

beforeEach(resetMocks);

// ── Fixture ──────────────────────────────────────────────────────────────────

function baseCredit(overrides: Partial<StoreCreditRow> = {}): StoreCreditRow {
  return {
    id: "sc-1",
    code: "BBJ-SC-AB12-CD34",
    customer_email: "buyer@example.com",
    customer_id: "cust-1",
    source_order_id: null,
    currency: "USD",
    original_amount_cents: 20000,
    remaining_amount_cents: 20000,
    status: "active",
    reason: "goodwill_resolution",
    customer_message: null,
    internal_note: null,
    issued_at: "2026-01-01T00:00:00.000Z",
    issued_by: "admin",
    starts_at: null,
    expires_at: null,
    minimum_merchandise_subtotal_cents: null,
    maximum_line_items: null,
    eligible_fulfillment_types: null,
    eligible_product_ids: null,
    eligible_collection_ids: null,
    excluded_product_ids: null,
    exclude_sale_items: false,
    exclude_clearance_items: false,
    allow_with_discount_codes: false,
    allow_with_other_store_credits: false,
    usage_mode: "reusable_until_balance_zero",
    maximum_credit_per_order_cents: null,
    maximum_credit_percentage: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const oneItem = [{ productId: "p1", fulfillmentType: "available_now" as const }];
const twoItems = [
  { productId: "p1", fulfillmentType: "available_now" as const },
  { productId: "p2", fulfillmentType: "sourced_for_you" as const },
];

// ── normalizeEmail / generateStoreCreditCodeCandidate ─────────────────────────

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Buyer@Example.COM  ")).toBe("buyer@example.com");
  });
});

describe("generateStoreCreditCodeCandidate", () => {
  it("matches the BBJ-SC-XXXX-XXXX format with no ambiguous characters", () => {
    const code = generateStoreCreditCodeCandidate();
    expect(code).toMatch(/^BBJ-SC-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });
});

// ── validateStoreCredit ────────────────────────────────────────────────────────

describe("validateStoreCredit", () => {
  it("accepts a valid, unrestricted credit", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit(), error: null });
    const result = await validateStoreCredit({
      code: "bbj-sc-ab12-cd34",
      email: "buyer@example.com",
      merchandiseSubtotalCents: 10000,
      orderTotalCents: 12000,
      items: oneItem,
      discountCodeApplied: false,
      otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.eligibleAmountCents).toBe(12000); // capped by order total, balance is larger
      expect(result.willForfeitRemainder).toBe(false);
    }
  });

  it("rejects a code that doesn't exist", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await validateStoreCredit({
      code: "NOPE", email: "buyer@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/could not be found/);
  });

  it("rejects an expired credit with the exact expiry date in the message", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ expires_at: "2020-01-01T12:00:00.000Z" }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("expired on January 1, 2020");
  });

  it("rejects a credit that hasn't started yet", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit({ starts_at: future }), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/not active yet/);
  });

  it("rejects when the checkout email doesn't match the credit's email", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit(), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "someone-else@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/different email address/);
  });

  it("rejects when the merchandise subtotal is below the minimum", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ minimum_merchandise_subtotal_cents: 50000 }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("$500.00 or more");
  });

  it("rejects a one-item-only credit when the cart has two items", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit({ maximum_line_items: 1 }), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: twoItems, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/one item/);
  });

  it("rejects a Ship-Now-only credit when the cart has a Sourced-for-You item", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ eligible_fulfillment_types: ["available_now"] }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: twoItems, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("This credit is valid for Ship Now pieces only.");
  });

  it("accepts a Sourced-for-You-only credit for an all-sourced cart", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ eligible_fulfillment_types: ["sourced_for_you"] }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: [{ productId: "p2", fulfillmentType: "sourced_for_you" }],
      discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a Sourced-for-You-only credit against a mixed cart", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ eligible_fulfillment_types: ["sourced_for_you"] }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: twoItems, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a cart containing a sale item when exclude_sale_items is set", async () => {
    // 1st call: from("store_credits").select().eq().maybeSingle() — the credit lookup.
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit({ exclude_sale_items: true }), error: null });
    // 2nd call: from("products").select().in(...) — .in() is the terminal call
    // here (no .maybeSingle() follows it in the exclusion-check code path).
    mockChain.in.mockResolvedValueOnce({ data: [{ id: "p1", status: "on_sale", is_clearance: false }], error: null });

    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/sale items/);
  });

  it("rejects when a discount code is applied and allow_with_discount_codes is false", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit(), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: oneItem, discountCodeApplied: true, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/discount currently applied/);
  });

  it("rejects when another store credit is applied and allow_with_other_store_credits is false", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit(), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 10000, orderTotalCents: 10000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: true,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/another store credit/);
  });

  it("caps the eligible amount at the remaining balance for a partial-balance redemption", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit({ remaining_amount_cents: 5000 }), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 20000, orderTotalCents: 25000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.eligibleAmountCents).toBe(5000);
  });

  it("flags willForfeitRemainder for a single-use credit that can't be fully applied", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ usage_mode: "single_use", remaining_amount_cents: 20000 }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 5000, orderTotalCents: 5000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.eligibleAmountCents).toBe(5000);
      expect(result.willForfeitRemainder).toBe(true);
    }
  });

  it("does not flag forfeiture for a full-balance redemption", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ usage_mode: "single_use", remaining_amount_cents: 5000 }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 5000, orderTotalCents: 5000,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.willForfeitRemainder).toBe(false);
  });

  it("rejects an already-fully-used credit", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({
      data: baseCredit({ status: "fully_used", remaining_amount_cents: 0 }), error: null,
    });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/already been fully used/);
  });

  it("rejects a revoked credit", async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseCredit({ status: "revoked" }), error: null });
    const result = await validateStoreCredit({
      code: "BBJ-SC-AB12-CD34", email: "buyer@example.com", merchandiseSubtotalCents: 100, orderTotalCents: 100,
      items: oneItem, discountCodeApplied: false, otherStoreCreditApplied: false,
    });
    expect(result.valid).toBe(false);
  });
});

// ── getStoreCreditDisplayConditions ─────────────────────────────────────────────

describe("getStoreCreditDisplayConditions", () => {
  it("produces only the non-expiration boilerplate lines when nothing else is set", () => {
    const lines = getStoreCreditDisplayConditions(baseCredit());
    expect(lines.some((l) => l.startsWith("Expires on"))).toBe(false);
    expect(lines).toContain("Cannot be combined with another discount code.");
    expect(lines).toContain("Cannot be combined with another store credit.");
    expect(lines).toContain("Any unused balance will remain available until the credit expires.");
    expect(lines.some((l) => l.includes("non-transferable"))).toBe(true);
  });

  it("includes every applicable condition line, and only those, for a fully-configured credit", () => {
    const lines = getStoreCreditDisplayConditions(baseCredit({
      expires_at: "2026-09-30T12:00:00.000Z",
      minimum_merchandise_subtotal_cents: 50000,
      maximum_line_items: 1,
      eligible_fulfillment_types: ["available_now"],
      exclude_sale_items: true,
      exclude_clearance_items: true,
      usage_mode: "single_use",
      maximum_credit_per_order_cents: 20000,
      maximum_credit_percentage: 25,
    }));
    expect(lines).toContain("Expires on September 30, 2026.");
    expect(lines).toContain("Valid on merchandise purchases of $500.00 or more.");
    expect(lines).toContain("May be applied to an order containing one merchandise item only.");
    expect(lines).toContain("Valid for Ship Now pieces only.");
    expect(lines).toContain("Not valid on sale items.");
    expect(lines).toContain("Not valid on clearance items.");
    expect(lines).toContain("This credit may be used once. Any unused amount will be forfeited after redemption.");
    expect(lines).toContain("A maximum of $200.00 may be applied per order.");
    expect(lines).toContain("The credit may cover up to 25% of the order total.");
    expect(lines.some((l) => l.includes("non-transferable"))).toBe(true);
  });

  it("checkout and email use the same formatter, so wording is always identical", () => {
    const credit = baseCredit({ expires_at: "2026-12-25T00:00:00.000Z", maximum_line_items: 1 });
    expect(getStoreCreditDisplayConditions(credit)).toEqual(getStoreCreditDisplayConditions(credit));
  });
});

// ── Reservation / redemption / restoration wrappers ───────────────────────────

describe("reserveStoreCredit", () => {
  it("calls reserve_store_credit and returns the transaction id on success", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: "txn-1", error: null });
    const result = await reserveStoreCredit({ storeCreditId: "sc-1", amountCents: 1000, checkoutReference: "ref-1" });
    expect(mockChain.rpc).toHaveBeenCalledWith("reserve_store_credit", {
      p_store_credit_id: "sc-1", p_amount_cents: 1000, p_checkout_reference: "ref-1", p_created_by: "checkout",
    });
    expect(result).toEqual({ reserved: true, transactionId: "txn-1" });
  });

  it("returns reserved:false when the RPC returns no row (insufficient balance / race lost)", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await reserveStoreCredit({ storeCreditId: "sc-1", amountCents: 1000, checkoutReference: "ref-1" });
    expect(result).toEqual({ reserved: false });
  });

  it("returns reserved:false on an RPC error (e.g. two simultaneous redemption attempts)", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: null, error: { message: "concurrent update" } });
    const result = await reserveStoreCredit({ storeCreditId: "sc-1", amountCents: 1000, checkoutReference: "ref-1" });
    expect(result).toEqual({ reserved: false });
  });
});

describe("releaseStoreCreditReservation", () => {
  it("calls release_store_credit_reservation with the checkout reference", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: true, error: null });
    const ok = await releaseStoreCreditReservation("ref-1");
    expect(mockChain.rpc).toHaveBeenCalledWith("release_store_credit_reservation", { p_checkout_reference: "ref-1" });
    expect(ok).toBe(true);
  });

  it("is safe to call for a checkout session expiration with no live reservation", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: false, error: null });
    const ok = await releaseStoreCreditReservation("ref-none");
    expect(ok).toBe(false);
  });
});

describe("redeemStoreCreditReservation", () => {
  it("calls redeem_store_credit_reservation with the checkout reference and order id", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: true, error: null });
    const ok = await redeemStoreCreditReservation("ref-1", "order-1");
    expect(mockChain.rpc).toHaveBeenCalledWith("redeem_store_credit_reservation", {
      p_checkout_reference: "ref-1", p_order_id: "order-1",
    });
    expect(ok).toBe(true);
  });
});

describe("restoreStoreCredit", () => {
  it("calls restore_store_credit for a full cancellation", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: true, error: null });
    const ok = await restoreStoreCredit({ storeCreditId: "sc-1", amountCents: 1000, orderId: "order-1", reason: "cancelled" });
    expect(mockChain.rpc).toHaveBeenCalledWith("restore_store_credit", {
      p_store_credit_id: "sc-1", p_amount_cents: 1000, p_order_id: "order-1", p_reason: "cancelled", p_created_by: "system",
    });
    expect(ok).toBe(true);
  });

  it("is a no-op that returns true when there is nothing to restore (amount 0)", async () => {
    const ok = await restoreStoreCredit({ storeCreditId: "sc-1", amountCents: 0, orderId: "order-1" });
    expect(ok).toBe(true);
    expect(mockChain.rpc).not.toHaveBeenCalled();
  });
});

describe("adjustStoreCreditBalance", () => {
  it("calls adjust_store_credit_balance with a required reason", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: true, error: null });
    const ok = await adjustStoreCreditBalance({ storeCreditId: "sc-1", deltaCents: -500, reason: "correction", createdBy: "admin" });
    expect(mockChain.rpc).toHaveBeenCalledWith("adjust_store_credit_balance", {
      p_store_credit_id: "sc-1", p_delta_cents: -500, p_reason: "correction", p_created_by: "admin",
    });
    expect(ok).toBe(true);
  });

  it("returns false when the adjustment would take the balance below zero", async () => {
    mockChain.rpc.mockResolvedValueOnce({ data: false, error: null });
    const ok = await adjustStoreCreditBalance({ storeCreditId: "sc-1", deltaCents: -999999, reason: "oops", createdBy: "admin" });
    expect(ok).toBe(false);
  });
});
