import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // increased — full pagination can take longer

// Syncs ALL paid Stripe Checkout Sessions into:
//   1. stripe_accounting_snapshots (raw Stripe data)
//   2. order_payments (universal payment ledger)
//
// Order matching strategy (in priority order):
//   1. orders.stripe_session_id = cs.id
//   2. orders.stripe_payment_intent_id = pi.id
//   3. orders.customer_email = cs.customer_email AND amount_total within $0.01 (fallback)
//
// Fully paginates — no session cap.

export async function POST() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pre-load all orders so we can do fallback matching in memory without N+1 queries
  type OrderRow = {
    id: string;
    order_number: string | null;
    stripe_session_id: string | null;
    stripe_payment_intent_id: string | null;
    amount_total: number | null;
    customer_email: string | null;
  };

  const { data: allOrders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, stripe_session_id, stripe_payment_intent_id, amount_total, customer_email")
    .neq("order_status", "order_cancelled");

  // Build lookup indexes
  const bySessionId  = new Map<string, OrderRow>();
  const byPiId       = new Map<string, OrderRow>();
  // email+amount → order (fallback; collisions possible but rare)
  const byEmailAmt   = new Map<string, OrderRow>();

  for (const o of (allOrders ?? []) as OrderRow[]) {
    if (o.stripe_session_id)         bySessionId.set(o.stripe_session_id as string, o);
    if (o.stripe_payment_intent_id)  byPiId.set(o.stripe_payment_intent_id as string, o);
    if (o.customer_email && o.amount_total) {
      const key = `${(o.customer_email as string).toLowerCase()}:${o.amount_total}`;
      if (!byEmailAmt.has(key)) byEmailAmt.set(key, o); // first match wins
    }
  }

  let synced = 0;
  let unmatched = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const listParams: Stripe.Checkout.SessionListParams = {
      limit: 100,
      expand: [
        "data.payment_intent",
        "data.payment_intent.latest_charge",
        "data.payment_intent.latest_charge.balance_transaction",
        "data.total_details",
        "data.line_items",
      ],
    };
    if (startingAfter) listParams.starting_after = startingAfter;

    const sessions = await stripe.checkout.sessions.list(listParams);

    for (const cs of sessions.data) {
      try {
        const pi     = cs.payment_intent as Stripe.PaymentIntent | null;
        const charge = pi?.latest_charge   as Stripe.Charge | null;
        const balTxn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
        const refundedCents = charge?.amount_refunded ?? 0;

        // ── Extract line items for fee_breakdown backfill ─────────────────────
        // Parses shipping, insurance, tax, and transaction fee from checkout line items.
        // Used to fix old orders whose fee_breakdown was incomplete.
        const lineItems = (cs.line_items?.data ?? []) as Stripe.LineItem[];
        let liShippingCents  = 0;
        let liInsuranceCents = 0;
        let liTaxCents       = 0;
        let liTxFeeCents     = 0;
        let liBnplFeeCents   = 0;
        let liDiscountCents  = 0;
        for (const li of lineItems) {
          // Always trim — Stripe description whitespace is inconsistent
          const name = (li.description ?? "").trim();
          // Check insurance BEFORE generic shipping (both start with "Shipping")
          if (name.startsWith("Shipping Insurance")) {
            liInsuranceCents += li.amount_total ?? 0;
          } else if (name.startsWith("Shipping") || name.startsWith("Priority Sourcing")) {
            liShippingCents += li.amount_total ?? 0;
          } else if (name === "Sales Tax" || name === "Tax") {
            liTaxCents += li.amount_total ?? 0;
          } else if (name.startsWith("Transaction Fee")) {
            liTxFeeCents += li.amount_total ?? 0;
          } else if (name.startsWith("Installment Fee")) {
            liBnplFeeCents += li.amount_total ?? 0;
          }
          for (const d of li.discounts ?? []) {
            liDiscountCents += d.amount ?? 0;
          }
        }
        // Stripe Tax fallback (only if no custom Sales Tax line item found)
        const stripeTaxCents = cs.total_details?.amount_tax ?? 0;
        if (liTaxCents === 0 && stripeTaxCents > 0) liTaxCents = stripeTaxCents;

        // ── Order matching ────────────────────────────────────────────────────
        let matchedOrder: OrderRow | null | undefined = null;

        // 1. By session ID (most reliable)
        if (cs.id) matchedOrder = bySessionId.get(cs.id);

        // 2. By payment intent ID
        if (!matchedOrder && pi?.id) matchedOrder = byPiId.get(pi.id);

        // 3. By email + amount (fallback for orders created before IDs were stored)
        if (!matchedOrder && cs.customer_email && cs.amount_total) {
          const key = `${cs.customer_email.toLowerCase()}:${cs.amount_total}`;
          matchedOrder = byEmailAmt.get(key) ?? null;
        }

        const orderId     = matchedOrder?.id          ?? null;
        const orderNumber = matchedOrder?.order_number ?? null;
        if (!orderId) unmatched++;

        // ── 1. stripe_accounting_snapshots ────────────────────────────────────
        const snapshot = {
          stripe_payment_intent_id: pi?.id ?? null,
          stripe_session_id:        cs.id,
          order_id:                 orderId,
          amount_total_cents:       cs.amount_total,
          amount_subtotal_cents:    cs.amount_subtotal,
          amount_shipping_cents:    cs.total_details?.amount_shipping   ?? null,
          amount_tax_cents:         cs.total_details?.amount_tax        ?? null,
          amount_discount_cents:    cs.total_details?.amount_discount   ?? null,
          stripe_fee_cents:         balTxn?.fee  ?? null,
          stripe_net_cents:         balTxn?.net  ?? null,
          refunded_amount_cents:    refundedCents,
          stripe_currency:          cs.currency ?? "usd",
          stripe_status:            pi?.status ?? cs.payment_status ?? null,
          stripe_created_at:        cs.created ? new Date(cs.created * 1000).toISOString() : null,
          synced_at:                new Date().toISOString(),
          raw_balance_txn_id:       balTxn?.id ?? null,
          raw_data: {
            session_id:             cs.id,
            payment_intent_id:      pi?.id,
            charge_id:              charge?.id,
            balance_transaction_id: balTxn?.id,
            payment_status:         cs.payment_status,
          },
        };

        await supabaseAdmin
          .from("stripe_accounting_snapshots")
          .upsert(snapshot, { onConflict: "stripe_payment_intent_id" });

        // ── 2. order_payments — write for any paid session ────────────────────
        // Includes sessions matched to orders AND unmatched ones (order_id: null).
        // Unmatched ones surface in the Unmatched tab for manual linking.
        if (pi?.id && cs.amount_total && cs.payment_status === "paid") {
          const amountUsd   = cs.amount_total / 100;
          const feeUsd      = balTxn?.fee != null ? balTxn.fee / 100 : 0;
          const netUsd      = balTxn?.net != null ? balTxn.net / 100 : amountUsd - feeUsd;
          const refundedUsd = refundedCents / 100;

          let paymentStatus: string = "paid";
          if (refundedCents > 0 && refundedCents >= cs.amount_total) paymentStatus = "refunded";
          else if (refundedCents > 0) paymentStatus = "partially_refunded";
          else if (pi.status === "canceled") paymentStatus = "failed";

          const paymentRow = {
            order_id:                orderId,
            bbj_order_code:          orderNumber,
            payment_provider:        "stripe",
            payment_type:            "checkout",
            provider_transaction_id: pi.id,
            provider_receipt_id:     charge?.receipt_url ?? null,
            provider_invoice_id:     null,
            amount_paid_usd:         amountUsd,
            currency:                (cs.currency ?? "usd").toUpperCase(),
            payment_fee_usd:         feeUsd,
            net_received_usd:        netUsd - refundedUsd,
            payment_date:            cs.created
              ? new Date(cs.created * 1000).toISOString()
              : new Date().toISOString(),
            payment_status:          paymentStatus,
            proof_url:               null,
            notes:                   `Stripe Checkout ${cs.id}`,
          };

          const { data: existing } = await supabaseAdmin
            .from("order_payments")
            .select("id, order_id")
            .eq("payment_provider", "stripe")
            .eq("provider_transaction_id", pi.id)
            .maybeSingle();

          if (existing) {
            // If we now have an order match but the existing row didn't, update it
            const update: typeof paymentRow & { order_id?: string | null; bbj_order_code?: string | null } = { ...paymentRow };
            if (!existing.order_id && orderId) {
              update.order_id       = orderId;
              update.bbj_order_code = orderNumber;
            }
            await supabaseAdmin
              .from("order_payments")
              .update(update)
              .eq("id", existing.id);
          } else {
            // Remove any backfill placeholder for this order before inserting the real Stripe record
            if (orderId) {
              await supabaseAdmin
                .from("order_payments")
                .delete()
                .eq("order_id", orderId)
                .eq("payment_type", "order_backfill");
            }
            await supabaseAdmin
              .from("order_payments")
              .insert(paymentRow);
          }
        }

        // ── 3. Backfill fee_breakdown on matched orders ───────────────────────
        // Only updates if line items gave us data that the order is missing.
        // Preserves existing fee_breakdown keys; only fills gaps.
        if (orderId && lineItems.length > 0) {
          const { data: orderRow } = await supabaseAdmin
            .from("orders")
            .select("fee_breakdown")
            .eq("id", orderId)
            .maybeSingle();

          if (orderRow) {
            const existing = (orderRow.fee_breakdown ?? {}) as Record<string, number | string>;
            const patch: Record<string, number> = {};

            if (!existing.shipping  && liShippingCents  > 0) patch.shipping  = liShippingCents  / 100;
            if (!existing.insurance && liInsuranceCents > 0) patch.insurance = liInsuranceCents / 100;
            if (!existing.tax       && liTaxCents       > 0) patch.tax       = liTaxCents       / 100;
            if (!existing.paypal    && liTxFeeCents     > 0) patch.paypal    = liTxFeeCents     / 100;
            if (!existing.bnpl      && liBnplFeeCents   > 0) patch.bnpl      = liBnplFeeCents   / 100;

            if (Object.keys(patch).length > 0) {
              await supabaseAdmin
                .from("orders")
                .update({ fee_breakdown: { ...existing, ...patch } })
                .eq("id", orderId);
            }
          }
        }

        synced++;
      } catch (err) {
        console.error("[sync-stripe] Failed to process session", cs.id, err);
      }
    }

    hasMore = sessions.has_more;
    if (sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1].id;
    } else {
      break;
    }
  }

  // ── Backfill phase ────────────────────────────────────────────────────────
  // For every non-cancelled order that still has no entry in order_payments,
  // auto-create one from the order's own data. This covers:
  //   - Zelle, PayPal, cash orders (payment verified before order creation)
  //   - Stripe orders whose session couldn't be matched above
  //   - Any historical order predating the payment ledger
  //
  // These rows use payment_type = 'order_backfill' so they can be identified
  // and replaced later if richer data becomes available (e.g. Stripe sync match).
  // Fee is 0 for non-Stripe sources — net = amount.

  // Find all order IDs that now have at least one payment record
  const { data: coveredPayments } = await supabaseAdmin
    .from("order_payments")
    .select("order_id")
    .not("order_id", "is", null);

  const coveredOrderIds = new Set((coveredPayments ?? []).map((p) => p.order_id as string));

  // Fetch all non-cancelled orders that need a backfill record
  const { data: unpaidOrders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, source, amount_total, created_at")
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null);

  const toBackfill = (unpaidOrders ?? []).filter(
    (o) => !coveredOrderIds.has(o.id as string)
  );

  let backfilled = 0;
  if (toBackfill.length > 0) {
    const backfillRows = toBackfill.map((o) => {
      const amountUsd = (o.amount_total as number) / 100;
      const src       = (o.source as string) ?? "unknown";
      // Map order source to payment_provider value
      const provider  = ["stripe", "paypal", "zelle", "cash"].includes(src) ? src : "other";
      return {
        order_id:                o.id,
        bbj_order_code:          o.order_number,
        payment_provider:        provider,
        payment_type:            "order_backfill",
        provider_transaction_id: null,
        provider_receipt_id:     null,
        provider_invoice_id:     null,
        amount_paid_usd:         amountUsd,
        currency:                "USD",
        payment_fee_usd:         0,
        net_received_usd:        amountUsd,
        payment_date:            o.created_at,
        payment_status:          "paid",
        proof_url:               null,
        notes:                   `Auto-backfilled from order (source: ${src})`,
      };
    });

    // Insert in batches of 50
    for (let i = 0; i < backfillRows.length; i += 50) {
      const { error } = await supabaseAdmin
        .from("order_payments")
        .insert(backfillRows.slice(i, i + 50));
      if (!error) backfilled += Math.min(50, backfillRows.length - i);
    }
  }

  // ── Balance Transactions phase ────────────────────────────────────────────
  // Paginate ALL balance transactions from Stripe to:
  //   1. Update order_payments.payment_fee_usd / net_received_usd with exact fees
  //      using raw_balance_txn_id already stored in stripe_accounting_snapshots
  //   2. Compute totalStripeFees matching Stripe's Balance Summary
  //
  // Strategy: we already stored raw_balance_txn_id in stripe_accounting_snapshots
  // during the checkout session sync above. Use those IDs to fetch balance txns
  // directly — no need to re-fetch every charge individually.
  //
  // For totalStripeFees we paginate all balance txns and sum bt.fee.
  // Standalone stripe_fee / tax_fee rows are included via their amount field.

  // Build balTxn id → order_payments id lookup from snapshots we just wrote
  const { data: snapWithBalTxn } = await supabaseAdmin
    .from("stripe_accounting_snapshots")
    .select("raw_balance_txn_id, stripe_payment_intent_id")
    .not("raw_balance_txn_id", "is", null);

  // Also load order_payments keyed by PI id
  const { data: stripePaymentRows } = await supabaseAdmin
    .from("order_payments")
    .select("id, provider_transaction_id, payment_fee_usd")
    .eq("payment_provider", "stripe")
    .not("provider_transaction_id", "is", null);

  const piToPaymentRow = new Map<string, { id: string; current_fee: number }>();
  for (const row of stripePaymentRows ?? []) {
    if (row.provider_transaction_id) {
      piToPaymentRow.set(row.provider_transaction_id as string, {
        id:          row.id as string,
        current_fee: Number(row.payment_fee_usd),
      });
    }
  }

  // Map balTxn id → PI id from snapshots
  const balTxnToPi = new Map<string, string>();
  for (const s of snapWithBalTxn ?? []) {
    if (s.raw_balance_txn_id && s.stripe_payment_intent_id) {
      balTxnToPi.set(s.raw_balance_txn_id as string, s.stripe_payment_intent_id as string);
    }
  }

  let totalStripeFeeCents = 0;
  let balHasMore = true;
  let balStartingAfter: string | undefined;

  while (balHasMore) {
    const balParams: Stripe.BalanceTransactionListParams = { limit: 100 };
    if (balStartingAfter) balParams.starting_after = balStartingAfter;

    const balTxns = await stripe.balanceTransactions.list(balParams);

    for (const bt of balTxns.data) {
      // Standalone fee rows: amount is already the fee itself (negative in payout context)
      if (bt.type === "stripe_fee" || bt.type === "tax_fee") {
        totalStripeFeeCents += Math.abs(bt.amount);
        continue;
      }

      // For all other types, fee is the Stripe processing cut
      totalStripeFeeCents += bt.fee;

      // Update the matching order_payments row with the exact fee
      if (bt.fee > 0) {
        const piId = balTxnToPi.get(bt.id);
        if (piId) {
          const pmRow = piToPaymentRow.get(piId);
          if (pmRow && Math.abs(pmRow.current_fee - bt.fee / 100) > 0.005) {
            await supabaseAdmin
              .from("order_payments")
              .update({
                payment_fee_usd:  bt.fee / 100,
                net_received_usd: bt.net / 100,
              })
              .eq("id", pmRow.id);
            // Update local cache so duplicate balTxns don't re-write
            pmRow.current_fee = bt.fee / 100;
          }
        }
      }
    }

    balHasMore = balTxns.has_more;
    if (balTxns.data.length > 0) {
      balStartingAfter = balTxns.data[balTxns.data.length - 1].id;
    } else {
      break;
    }
  }

  const totalStripeFees = totalStripeFeeCents / 100;

  const { count: paymentCount } = await supabaseAdmin
    .from("order_payments")
    .select("*", { count: "exact", head: true })
    .eq("payment_provider", "stripe");

  return NextResponse.json({
    synced,
    unmatched,
    backfilled,
    totalStripeFees,
    stripePaymentsInLedger: paymentCount ?? 0,
    syncedAt: new Date().toISOString(),
  });
}

// GET: return last sync timestamp and snapshot count
export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ count: snapshotCount }, { data: latest }, { count: paymentCount }] = await Promise.all([
    supabaseAdmin
      .from("stripe_accounting_snapshots")
      .select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("stripe_accounting_snapshots")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("order_payments")
      .select("*", { count: "exact", head: true })
      .eq("payment_provider", "stripe"),
  ]);

  return NextResponse.json({
    snapshotCount:  snapshotCount  ?? 0,
    paymentCount:   paymentCount   ?? 0,
    lastSyncedAt:   latest?.synced_at ?? null,
  });
}
