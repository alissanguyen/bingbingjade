import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClaim, evaluateClaimEligibility, getClaimWindows, CLAIM_TYPE_LABELS, type ClaimType, type ClaimSubtype, type FitIssue } from "@/lib/claims";

// Customer-facing claims list + submission for a delivered order.
//
// Access model matches the existing /orders/[orderNumber] page: no customer
// login exists anywhere in this codebase (see lib/approved-auth.ts — that
// system is admin/employee-only), so access is order-number-keyed, same
// exposure the order status page already has. Claim *creation* additionally
// requires the submitted email to match the order's customer_email — the
// same second-factor check lib/store-credit.ts's validateStoreCredit()
// already uses — so knowing the order number alone isn't enough to open a
// claim as someone else.

async function loadOrder(orderNumber: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, order_status, customer_email, customer_id, status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return order;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await loadOrder(orderNumber);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const [{ data: claims }, { data: orderItems }, { data: shipments }, claimWindows] = await Promise.all([
    supabaseAdmin
      .from("claims")
      .select("id, claim_number, claim_type, claim_subtype, status, responsibility, opened_at, resolved_at, closed_at")
      .eq("order_id", order.id)
      .order("opened_at", { ascending: false }),
    supabaseAdmin.from("order_items").select("id, product_name, option_label, price_usd, inventory_type").eq("order_id", order.id),
    supabaseAdmin.from("shipments").select("delivered_at").eq("order_id", order.id),
    getClaimWindows(),
  ]);

  const deliveredAt = (shipments ?? []).map((s) => s.delivered_at).filter(Boolean).sort().pop() ?? null;

  return NextResponse.json({
    claims: claims ?? [],
    orderItems: orderItems ?? [],
    canSubmitClaim: order.order_status === "delivered",
    deliveredAt,
    claimWindows,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await loadOrder(orderNumber);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let body: {
    customerEmail?: string;
    claimType?: ClaimType;
    claimSubtype?: ClaimSubtype;
    fitIssue?: FitIssue;
    description?: string;
    orderItemIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.customerEmail || body.customerEmail.trim().toLowerCase() !== (order.customer_email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "Email does not match this order." }, { status: 403 });
  }
  if (!body.claimType || !(body.claimType in CLAIM_TYPE_LABELS)) {
    return NextResponse.json({ error: "Invalid claim type." }, { status: 400 });
  }
  if (!body.orderItemIds || body.orderItemIds.length === 0) {
    return NextResponse.json({ error: "Select at least one affected item." }, { status: 400 });
  }

  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("id, inventory_type")
    .eq("order_id", order.id)
    .in("id", body.orderItemIds);
  if (!orderItems || orderItems.length !== body.orderItemIds.length) {
    return NextResponse.json({ error: "One or more items don't belong to this order." }, { status: 400 });
  }

  const { data: shipments } = await supabaseAdmin.from("shipments").select("delivered_at").eq("order_id", order.id);
  const deliveredAt = (shipments ?? []).map((s) => s.delivered_at).filter(Boolean).sort().pop() ?? null;

  const { data: priorClaims } = await supabaseAdmin
    .from("claim_items")
    .select("claim_id, claims!inner(claim_type, status)")
    .in("order_item_id", body.orderItemIds);
  const priorClaimExists = (priorClaims ?? []).some(
    (c) => (c.claims as unknown as { claim_type: string; status: string }).claim_type === body.claimType &&
      (c.claims as unknown as { claim_type: string; status: string }).status !== "closed"
  );

  const eligibility = await evaluateClaimEligibility({
    orderStatus: order.order_status,
    deliveredAt,
    claimType: body.claimType,
    fitIssue: body.fitIssue ?? null,
    inventoryTypes: [...new Set(orderItems.map((i) => i.inventory_type).filter(Boolean))] as string[],
    priorClaimExists,
  });

  if (eligibility.result === "ineligible") {
    return NextResponse.json({ error: eligibility.reason, eligibility }, { status: 422 });
  }

  const claim = await createClaim({
    orderId: order.id,
    customerEmail: order.customer_email!,
    customerId: order.customer_id,
    claimType: body.claimType,
    claimSubtype: body.claimSubtype ?? null,
    fitIssue: body.fitIssue ?? null,
    description: body.description?.trim() || null,
    orderItemIds: body.orderItemIds,
    eligibility,
  });

  return NextResponse.json({ claim, eligibility }, { status: 201 });
}
