import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin, approvedCreatedBy } from "@/lib/approved-auth";
import { issueStoreCredit, getStoreCreditDisplayConditions } from "@/lib/store-credit";
import { sendStoreCreditIssuedEmail } from "@/lib/discount-emails";
import type { StoreCreditReason, StoreCreditUsageMode } from "@/lib/store-credit";
import type { FulfillmentType } from "@/types/cart";

function actorId(session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>): string {
  return session.type === "admin" ? "admin" : approvedCreatedBy(session.user.id);
}

// GET — list/search/filter store credits (admin + approved users, read-only)
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const status = searchParams.get("status") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const from = (page - 1) * limit;

  let query = supabaseAdmin
    .from("store_credits")
    .select("id, code, customer_email, source_order_id, original_amount_cents, remaining_amount_cents, status, reason, expires_at, issued_at, issued_by, orders:source_order_id(order_number)", { count: "exact" })
    .order("issued_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq("status", status);

  if (search) {
    // Order-number search requires a join lookup first (Supabase .or() can't
    // reach through a foreign table), so resolve it to an order id set.
    const { data: matchingOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .ilike("order_number", `%${search}%`);
    const orderIds = (matchingOrders ?? []).map((o) => o.id);

    const orClauses = [
      `code.ilike.%${search}%`,
      `customer_email.ilike.%${search}%`,
      `reason.ilike.%${search}%`,
    ];
    if (orderIds.length > 0) {
      orClauses.push(`source_order_id.in.(${orderIds.join(",")})`);
    }
    query = query.or(orClauses.join(","));
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ storeCredits: data ?? [], total: count ?? 0, page, limit });
}

// POST — issue a new store credit
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    amountCents?: number;
    customerEmail?: string;
    sourceOrderId?: string | null;
    currency?: string;
    reason?: StoreCreditReason;
    customerMessage?: string | null;
    internalNote?: string | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    minimumMerchandiseSubtotalCents?: number | null;
    maximumLineItems?: number | null;
    eligibleFulfillmentTypes?: FulfillmentType[] | null;
    eligibleProductIds?: string[] | null;
    eligibleCollectionIds?: string[] | null;
    excludedProductIds?: string[] | null;
    excludeSaleItems?: boolean;
    excludeClearanceItems?: boolean;
    allowWithDiscountCodes?: boolean;
    allowWithOtherStoreCredits?: boolean;
    usageMode?: StoreCreditUsageMode;
    maximumCreditPerOrderCents?: number | null;
    maximumCreditPercentage?: number | null;
    sendEmail?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "Credit amount is required." }, { status: 400 });
  }
  if (!body.customerEmail?.trim()) {
    return NextResponse.json({ error: "Customer email is required." }, { status: 400 });
  }
  if (!body.reason) {
    return NextResponse.json({ error: "Reason for issuance is required." }, { status: 400 });
  }

  let customerId: string | null = null;
  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("customer_email", body.customerEmail.trim().toLowerCase())
    .maybeSingle();
  customerId = existingCustomer?.id ?? null;

  const storeCredit = await issueStoreCredit({
    amountCents: body.amountCents,
    customerEmail: body.customerEmail,
    customerId,
    sourceOrderId: body.sourceOrderId ?? null,
    currency: body.currency,
    reason: body.reason,
    customerMessage: body.customerMessage ?? null,
    internalNote: body.internalNote ?? null,
    issuedBy: actorId(session),
    startsAt: body.startsAt ?? null,
    expiresAt: body.expiresAt ?? null,
    minimumMerchandiseSubtotalCents: body.minimumMerchandiseSubtotalCents ?? null,
    maximumLineItems: body.maximumLineItems ?? null,
    eligibleFulfillmentTypes: body.eligibleFulfillmentTypes ?? null,
    eligibleProductIds: body.eligibleProductIds ?? null,
    eligibleCollectionIds: body.eligibleCollectionIds ?? null,
    excludedProductIds: body.excludedProductIds ?? null,
    excludeSaleItems: body.excludeSaleItems ?? false,
    excludeClearanceItems: body.excludeClearanceItems ?? false,
    allowWithDiscountCodes: body.allowWithDiscountCodes ?? false,
    allowWithOtherStoreCredits: body.allowWithOtherStoreCredits ?? false,
    usageMode: body.usageMode ?? "reusable_until_balance_zero",
    maximumCreditPerOrderCents: body.maximumCreditPerOrderCents ?? null,
    maximumCreditPercentage: body.maximumCreditPercentage ?? null,
  });

  let sourceOrderNumber: string | null = null;
  if (storeCredit.source_order_id) {
    const { data: srcOrder } = await supabaseAdmin
      .from("orders")
      .select("order_number, customer_name")
      .eq("id", storeCredit.source_order_id)
      .maybeSingle();
    sourceOrderNumber = srcOrder?.order_number ?? null;
  }

  if (body.sendEmail !== false) {
    try {
      const { data: customerRow } = customerId
        ? await supabaseAdmin.from("customers").select("customer_name").eq("id", customerId).maybeSingle()
        : { data: null };
      await sendStoreCreditIssuedEmail({
        storeCredit,
        customerName: customerRow?.customer_name ?? null,
        sourceOrderNumber,
        conditions: getStoreCreditDisplayConditions(storeCredit),
      });
    } catch (err) {
      console.error("[store-credits] Issuance email failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ storeCredit });
}
