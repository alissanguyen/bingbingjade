/**
 * PATCH /api/admin/listing-approvals/[listingId]
 *
 * Executes one admin review decision on an employee-submitted listing:
 * approve | approve_and_publish | request_adjustment | reject | duplicate.
 * The actual status transition + one-credit-per-product guarantee is
 * enforced inside fn_review_listing (migration_113) — this route just
 * validates input, calls it, and handles the side effects that can't live
 * in SQL (setting the sale price / admin financials, promoting draft media
 * to the public buckets on publish).
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { logAudit } from "@/lib/audit";
import { promoteProductDraftMedia } from "@/lib/storage";

type ReviewBody = {
  decision?: "approve" | "approve_and_publish" | "request_adjustment" | "reject" | "duplicate";
  employeeVisibleFeedback?: string;
  privateAdminNotes?: string;
  salePriceUsd?: number;
  onSalePriceUsd?: number;
  minimumPrice?: number;
  estimatedFees?: number;
  estimatedProfit?: number;
  estimatedMargin?: number;
};

const DECISIONS = ["approve", "approve_and_publish", "request_adjustment", "reject", "duplicate"];
const FEEDBACK_REQUIRED = ["request_adjustment", "reject", "duplicate"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await params;

  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.decision || !DECISIONS.includes(body.decision)) {
    return NextResponse.json({ error: "decision must be one of: " + DECISIONS.join(", ") }, { status: 400 });
  }
  if (FEEDBACK_REQUIRED.includes(body.decision) && !body.employeeVisibleFeedback?.trim()) {
    return NextResponse.json({ error: "employeeVisibleFeedback is required for this decision." }, { status: 400 });
  }

  const { data: rpcResult, error: rpcError } = await supabaseAdmin
    .rpc("fn_review_listing", {
      p_product_id: listingId,
      p_admin_id: "admin",
      p_decision: body.decision,
      p_employee_feedback: body.employeeVisibleFeedback?.trim() || null,
      p_admin_notes: body.privateAdminNotes?.trim() || null,
    })
    .single<{ new_status: string; credit_created: boolean }>();

  if (rpcError) {
    const msg = rpcError.message;
    if (msg.includes("product_not_found")) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (msg.includes("invalid_status")) {
      return NextResponse.json({ error: "This listing isn't awaiting approval right now (someone may have just reviewed it)." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const isApproval = body.decision === "approve" || body.decision === "approve_and_publish";

  if (isApproval) {
    const productUpdate: Record<string, unknown> = {};
    if (body.salePriceUsd !== undefined) productUpdate.price_display_usd = body.salePriceUsd;
    if (body.onSalePriceUsd !== undefined) productUpdate.sale_price_usd = body.onSalePriceUsd;
    if (Object.keys(productUpdate).length > 0) {
      await supabaseAdmin.from("products").update(productUpdate).eq("id", listingId);
    }

    if (
      body.minimumPrice !== undefined ||
      body.estimatedFees !== undefined ||
      body.estimatedProfit !== undefined ||
      body.estimatedMargin !== undefined ||
      body.privateAdminNotes !== undefined
    ) {
      await supabaseAdmin.from("admin_product_financials").upsert(
        {
          product_id: listingId,
          minimum_price: body.minimumPrice ?? null,
          estimated_fees: body.estimatedFees ?? null,
          estimated_profit: body.estimatedProfit ?? null,
          estimated_margin: body.estimatedMargin ?? null,
          private_admin_notes: body.privateAdminNotes?.trim() || null,
          updated_by_admin_id: "admin",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id" }
      );
    }
  }

  if (body.decision === "approve_and_publish") {
    const { data: product } = await supabaseAdmin.from("products").select("images, videos, slug").eq("id", listingId).maybeSingle();
    if (product) {
      const { failedImages, failedVideos } = await promoteProductDraftMedia(product.images ?? [], product.videos ?? []);
      if (failedImages.length > 0 || failedVideos.length > 0) {
        console.error("[listing-approvals] media promotion had failures", { listingId, failedImages, failedVideos });
      }
      if (product.slug) revalidatePath(`/products/${product.slug}`);
    }
    revalidatePath("/products");
  }

  await logAudit({
    actorUserId: "admin",
    action: `review_listing:${body.decision}`,
    entityType: "product",
    entityId: listingId,
    newValue: rpcResult,
    metadata: { employeeVisibleFeedback: body.employeeVisibleFeedback, privateAdminNotes: body.privateAdminNotes },
  });

  return NextResponse.json({ ok: true, ...rpcResult });
}
