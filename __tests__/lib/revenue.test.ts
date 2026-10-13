/**
 * Acceptance tests for the canonical revenue engine (lib/revenue.ts).
 *
 * Store credit redemption must never create new revenue — these tests pin
 * down the specific scenarios from the store-credit revenue audit,
 * including the two real orders that exposed the bug (BBJ-1360, BBJ-1361).
 */

import { describe, it, expect } from "vitest";
import {
  computeOrderRevenue,
  sumLedgerPaymentsCents,
  sumSucceededClaimRefundsCents,
  getSupersededSourceOrderIds,
  type OrderPaymentLedgerRow,
  type ClaimRefundLedgerRow,
} from "@/lib/revenue";

describe("computeOrderRevenue", () => {
  it("1. normal $1,000 Stripe order → revenue = $1,000", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "delivered" },
      [{ amount_paid_usd: 1000, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(100_000);
    expect(result.grossOrderValueCents).toBe(100_000);
    expect(result.storeCreditAppliedCents).toBe(0);
  });

  it("2. $1,000 order + $700 store credit + $300 Stripe → new revenue = $300", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 70_000, orderStatus: "delivered" },
      [{ amount_paid_usd: 300, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(30_000);
    expect(result.storeCreditAppliedCents).toBe(70_000);
    expect(result.grossOrderValueCents).toBe(100_000);
  });

  it("3. $1,000 order fully paid with store credit → new revenue = $0", () => {
    // Zero-balance order: no Stripe session was ever created, so no
    // order_payments rows exist — falls back to gross − storeCredit.
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 100_000, orderStatus: "delivered" },
      []
    );
    expect(result.netRevenueCents).toBe(0);
    expect(result.usedLedger).toBe(false);
  });

  it("4. store credit also covers fees/insurance → only actual external payment counts", () => {
    // Shape mirrors BBJ-1360: $1,550 merchandise + $91.92 tx fee + $3.05
    // insurance = $1,676.42 gross; $1,610.46 credit covers merchandise AND
    // part of the fees; only $65.96 was ever collected externally.
    const result = computeOrderRevenue(
      { amountTotalCents: 167_642, storeCreditUsedCents: 161_046, orderStatus: "inbound_shipping" },
      [{ amount_paid_usd: 65.96, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(6596);
  });

  it("5. cancelled order marked Paid → revenue = $0", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "order_cancelled" },
      [{ amount_paid_usd: 1000, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(0);
  });

  it("6. fully refunded order → refunded portion does not contribute to net revenue", () => {
    // The general refund route always flips order_status to
    // 'order_cancelled' AND order_payments to 'refunded' — either signal
    // alone already zeroes/excludes it; both together is the real shape.
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "order_cancelled" },
      [{ amount_paid_usd: 1000, payment_status: "refunded" }]
    );
    expect(result.netRevenueCents).toBe(0);
  });

  it("7. partial refund (via Claims workflow) → net revenue decreases by the refunded amount", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "delivered" },
      [{ amount_paid_usd: 1000, payment_status: "paid" }],
      [{ amount_usd: 200, status: "succeeded" }]
    );
    expect(result.netRevenueCents).toBe(80_000);
    expect(result.refundedCents).toBe(20_000);
  });

  it("7b. partial refund synced via Stripe webhook (negative ledger row) → net revenue decreases by the refunded amount", () => {
    // app/api/stripe/webhook/route.ts records a partial Stripe refund as its
    // own negative order_payments row rather than mutating the original —
    // the ledger sum must reflect that directly, with no separate refunds
    // array needed.
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "outbound_shipping" },
      [
        { amount_paid_usd: 1000, payment_status: "partially_refunded" },
        { amount_paid_usd: -200, payment_status: "paid" },
      ]
    );
    expect(result.netRevenueCents).toBe(80_000);
  });

  it("8. BBJ-1361 → new revenue = $210.63", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 229_900, storeCreditUsedCents: 208_837, orderStatus: "delivered" },
      [{ amount_paid_usd: 210.63, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(21_063);
    expect(result.grossOrderValueCents).toBe(229_900);
    expect(result.storeCreditAppliedCents).toBe(208_837);
  });

  it("9. BBJ-1360 → new revenue = $65.96", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 167_642, storeCreditUsedCents: 161_046, orderStatus: "inbound_shipping" },
      [{ amount_paid_usd: 65.96, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(6596);
  });

  it("falls back to gross − storeCredit when no ledger rows exist at all", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 50_000, storeCreditUsedCents: 20_000, orderStatus: "delivered" },
      []
    );
    expect(result.netRevenueCents).toBe(30_000);
    expect(result.usedLedger).toBe(false);
  });

  it("prefers the ledger over the fallback even when a stale stripe_amount_cents-style field would disagree", () => {
    // Historical anomaly found during the audit (BBJ-1340/1342/1354): the
    // Stripe charge was never actually reduced for store credit, so the
    // *real* external collection exceeds gross − storeCredit. The ledger
    // must win — it's what actually happened.
    const result = computeOrderRevenue(
      { amountTotalCents: 97_761, storeCreditUsedCents: 5000, orderStatus: "delivered" },
      [{ amount_paid_usd: 977.61, payment_status: "paid" }]
    );
    expect(result.netRevenueCents).toBe(97_761);
    expect(result.usedLedger).toBe(true);
  });

  it("never returns negative net revenue when refunds exceed collected amount", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "delivered" },
      [{ amount_paid_usd: 100, payment_status: "paid" }],
      [{ amount_usd: 500, status: "succeeded" }]
    );
    expect(result.netRevenueCents).toBe(0);
  });

  it("ignores pending/failed claim refunds", () => {
    const result = computeOrderRevenue(
      { amountTotalCents: 100_000, storeCreditUsedCents: 0, orderStatus: "delivered" },
      [{ amount_paid_usd: 1000, payment_status: "paid" }],
      [{ amount_usd: 200, status: "pending" }, { amount_usd: 50, status: "failed" }]
    );
    expect(result.netRevenueCents).toBe(100_000);
  });
});

describe("sumLedgerPaymentsCents", () => {
  it("excludes fully refunded and pending/failed rows", () => {
    const payments: OrderPaymentLedgerRow[] = [
      { amount_paid_usd: 100, payment_status: "paid" },
      { amount_paid_usd: 50, payment_status: "pending" },
      { amount_paid_usd: 25, payment_status: "failed" },
      { amount_paid_usd: 75, payment_status: "refunded" },
      { amount_paid_usd: 10, payment_status: "partially_refunded" },
    ];
    expect(sumLedgerPaymentsCents(payments)).toBe(11_000); // 100 + 10, in cents
  });

  it("nets out negative refund rows in the same sum", () => {
    const payments: OrderPaymentLedgerRow[] = [
      { amount_paid_usd: 1000, payment_status: "partially_refunded" },
      { amount_paid_usd: -200, payment_status: "paid" },
    ];
    expect(sumLedgerPaymentsCents(payments)).toBe(80_000);
  });
});

describe("sumSucceededClaimRefundsCents", () => {
  it("sums only succeeded refunds", () => {
    const refunds: ClaimRefundLedgerRow[] = [
      { amount_usd: 100, status: "succeeded" },
      { amount_usd: 50, status: "pending" },
      { amount_usd: 25, status: "succeeded" },
    ];
    expect(sumSucceededClaimRefundsCents(refunds)).toBe(12_500);
  });
});

describe("getSupersededSourceOrderIds", () => {
  it("excludes a source order once its refund-like credit has started being redeemed", () => {
    const ids = getSupersededSourceOrderIds([
      { source_order_id: "order-a", reason: "damaged_lost_package", original_amount_cents: 100_000, remaining_amount_cents: 0 },
    ]);
    expect(ids.has("order-a")).toBe(true);
  });

  it("does not exclude a source order whose credit is still fully unredeemed", () => {
    const ids = getSupersededSourceOrderIds([
      { source_order_id: "order-b", reason: "damaged_lost_package", original_amount_cents: 100_000, remaining_amount_cents: 100_000 },
    ]);
    expect(ids.has("order-b")).toBe(false);
  });

  it("does not exclude non-refund-like reasons (e.g. loyalty_vip, price_adjustment)", () => {
    const ids = getSupersededSourceOrderIds([
      { source_order_id: "order-c", reason: "loyalty_vip", original_amount_cents: 20_000, remaining_amount_cents: 0 },
    ]);
    expect(ids.has("order-c")).toBe(false);
  });

  it("excludes on partial redemption too, not just full", () => {
    const ids = getSupersededSourceOrderIds([
      { source_order_id: "order-d", reason: "return", original_amount_cents: 50_000, remaining_amount_cents: 30_000 },
    ]);
    expect(ids.has("order-d")).toBe(true);
  });

  it("ignores credits with no source_order_id", () => {
    const ids = getSupersededSourceOrderIds([
      { source_order_id: null, reason: "damaged_lost_package", original_amount_cents: 20_000, remaining_amount_cents: 0 },
    ]);
    expect(ids.size).toBe(0);
  });
});
