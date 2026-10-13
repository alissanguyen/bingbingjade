/**
 * Canonical revenue math — the one place that decides how much of an order
 * is real, newly-collected money vs. store credit vs. gross merchandise/fee
 * value. Every surface that reports revenue (Orders admin table + detail,
 * the legacy /api/admin/accounting dashboard, Full Detailed Accounting) must
 * derive its numbers from these functions rather than re-deriving them from
 * orders.amount_total directly — that field is gross order value, not
 * revenue, the moment store credit is involved.
 *
 * Three distinct concepts, never conflated:
 *   - Gross order value   (orders.amount_total)      — merchandise + fees +
 *     insurance + shipping. What the customer's invoice says they bought.
 *   - Store credit applied (orders.store_credit_used_cents) — a payment
 *     method / previously-issued value, not new money.
 *   - New revenue / external payment collected — money actually collected
 *     through Stripe, Zelle, PayPal, cash, etc. This is what "revenue"
 *     means everywhere in accounting.
 *
 * Source-of-truth priority for "money actually collected": the
 * order_payments ledger (real recorded payments) always wins when rows
 * exist for the order. Only when no ledger rows exist at all do we fall back
 * to `grossOrderValue - storeCreditApplied` (e.g. a zero-balance order that
 * never touched Stripe, or a historical order that predates ledger writes).
 * This also means a stale/never-reduced orders.stripe_amount_cents field
 * (a known issue on a few pre-fix historical orders — see the store-credit
 * revenue audit) never distorts net revenue: the ledger overrides it.
 *
 * Cancelled orders always contribute $0 net revenue, regardless of what the
 * ledger or orders.status say — this mirrors the existing `order_status !=
 * 'order_cancelled'` filter used across every accounting query.
 *
 * All money in/out of these functions is integer cents. No floating-point
 * dollar arithmetic.
 */

export type OrderPaymentStatus = "pending" | "paid" | "partially_refunded" | "refunded" | "failed";
export type ClaimRefundStatus = "pending" | "succeeded" | "failed";

export interface OrderPaymentLedgerRow {
  amount_paid_usd: number;
  payment_status: OrderPaymentStatus;
}

export interface ClaimRefundLedgerRow {
  amount_usd: number;
  status: ClaimRefundStatus;
}

export interface OrderRevenueInput {
  /** orders.amount_total — gross order value in cents. */
  amountTotalCents: number | null;
  /** orders.store_credit_used_cents. */
  storeCreditUsedCents: number | null;
  /** orders.order_status — 'order_cancelled' zeroes net revenue. */
  orderStatus: string | null;
}

export interface OrderRevenueBreakdown {
  /** Full merchandise + fees + insurance + shipping value — what the order is "worth". */
  grossOrderValueCents: number;
  /** Amount paid using store credit — never counted as new revenue. */
  storeCreditAppliedCents: number;
  /**
   * Gross external payment collected (Stripe/Zelle/PayPal/cash/etc.),
   * before subtracting claims-workflow cash refunds. From the
   * order_payments ledger when rows exist, else the fallback formula.
   */
  externalCollectedCents: number;
  /** Successful claims-workflow cash refunds against this order (claim_refunds), not yet reflected in order_payments. */
  refundedCents: number;
  /** The number every revenue report should sum: externalCollected − refunded, floored at 0, forced to 0 for cancelled orders. */
  netRevenueCents: number;
  /** True if order_payments rows were found and used as the source of truth (vs. the gross−storeCredit fallback). */
  usedLedger: boolean;
}

const CANCELLED_ORDER_STATUS = "order_cancelled";

/** Ledger statuses that still represent money the business holds (not yet fully refunded). */
const LIVE_PAYMENT_STATUSES = new Set<OrderPaymentStatus>(["paid", "partially_refunded"]);

/**
 * Sums the order_payments ledger for one order. Negative rows (payment_type
 * 'refund', e.g. a partial Stripe refund synced from the dashboard) net out
 * naturally since they're just more rows in the same sum.
 */
export function sumLedgerPaymentsCents(payments: OrderPaymentLedgerRow[]): number {
  return payments
    .filter((p) => LIVE_PAYMENT_STATUSES.has(p.payment_status))
    .reduce((sum, p) => sum + Math.round(Number(p.amount_paid_usd) * 100), 0);
}

/** Sums successful claims-workflow cash refunds for one order. */
export function sumSucceededClaimRefundsCents(refunds: ClaimRefundLedgerRow[]): number {
  return refunds
    .filter((r) => r.status === "succeeded")
    .reduce((sum, r) => sum + Math.round(Number(r.amount_usd) * 100), 0);
}

/**
 * The canonical per-order revenue breakdown. Pure function — no I/O. Callers
 * fetch `payments` (order_payments rows for this order) and `claimRefunds`
 * (claim_refunds rows for this order) themselves; passing `[]` for either is
 * safe and just falls back to the derived formula / skips the refund step.
 */
export function computeOrderRevenue(
  order: OrderRevenueInput,
  payments: OrderPaymentLedgerRow[] = [],
  claimRefunds: ClaimRefundLedgerRow[] = []
): OrderRevenueBreakdown {
  const grossOrderValueCents = Math.max(0, order.amountTotalCents ?? 0);
  const storeCreditAppliedCents = Math.max(0, order.storeCreditUsedCents ?? 0);
  const isCancelled = order.orderStatus === CANCELLED_ORDER_STATUS;

  const usedLedger = payments.length > 0;
  const externalCollectedCents = Math.max(
    0,
    usedLedger ? sumLedgerPaymentsCents(payments) : grossOrderValueCents - storeCreditAppliedCents
  );

  const refundedCents = sumSucceededClaimRefundsCents(claimRefunds);

  const netRevenueCents = isCancelled ? 0 : Math.max(0, externalCollectedCents - refundedCents);

  return {
    grossOrderValueCents,
    storeCreditAppliedCents,
    externalCollectedCents,
    refundedCents,
    netRevenueCents,
    usedLedger,
  };
}

// ── Batch helpers — group flat ledger query results by order_id ────────────

export function groupPaymentsByOrder<T extends OrderPaymentLedgerRow & { order_id: string | null }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.order_id) continue;
    const list = map.get(row.order_id);
    if (list) list.push(row);
    else map.set(row.order_id, [row]);
  }
  return map;
}

export function groupClaimRefundsByOrder<T extends ClaimRefundLedgerRow & { order_id: string | null }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.order_id) continue;
    const list = map.get(row.order_id);
    if (list) list.push(row);
    else map.set(row.order_id, [row]);
  }
  return map;
}

// ── Item revenue — merchandise-value supersession ───────────────────────────
//
// A store credit issued against a source order for a refund-like reason
// (damage, loss, cancellation, a Claims resolution) represents merchandise
// that's no longer the customer's — either it was never delivered, or it's
// coming back. Once any of that credit has actually been redeemed on a
// replacement order, the source order's own merchandise value must stop
// counting toward net Item Revenue — otherwise the same sale is counted
// once as the original item and again as the replacement item.
//
// Until redemption starts, nothing has actually superseded the source
// order's sale yet (the credit might never be used), so its item revenue
// stays intact — matching orders.amount_total staying intact for the same
// reason.

export type StoreCreditReasonForRevenue =
  | "goodwill_resolution" | "canceled_order" | "damaged_lost_package"
  | "return" | "price_adjustment" | "loyalty_vip" | "other"
  | "claim_resolution" | "exchange_credit";

/** Reasons that represent a refund-equivalent against a specific prior order (mirrors migration_124's refundCreditsQuery). */
export const REFUND_LIKE_STORE_CREDIT_REASONS: ReadonlySet<StoreCreditReasonForRevenue> = new Set([
  "canceled_order", "damaged_lost_package", "return", "claim_resolution", "exchange_credit",
]);

export interface SourceLinkedCreditRow {
  source_order_id: string | null;
  reason: string;
  original_amount_cents: number;
  remaining_amount_cents: number;
}

/**
 * Returns the set of order ids whose own merchandise value should be
 * excluded from net Item Revenue because a refund-like store credit issued
 * against them has started being redeemed elsewhere.
 */
export function getSupersededSourceOrderIds(credits: SourceLinkedCreditRow[]): Set<string> {
  const ids = new Set<string>();
  for (const c of credits) {
    if (!c.source_order_id) continue;
    if (!REFUND_LIKE_STORE_CREDIT_REASONS.has(c.reason as StoreCreditReasonForRevenue)) continue;
    const redeemedCents = c.original_amount_cents - c.remaining_amount_cents;
    if (redeemedCents > 0) ids.add(c.source_order_id);
  }
  return ids;
}
