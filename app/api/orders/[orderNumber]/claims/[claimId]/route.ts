import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveClaimEvidenceUrls } from "@/lib/storage";
import { customerFacingStatus, insuranceMessage } from "@/lib/claims";

// Customer claim detail — timeline/evidence are filtered to customer_visible
// only; internal notes, COGS, vendor reimbursements, carrier/insurance
// strategy are never included in this response (§39).

async function loadOrderAndClaim(orderNumber: string, claimId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) return { order: null, claim: null };

  const { data: claim } = await supabaseAdmin.from("claims").select("*").eq("id", claimId).eq("order_id", order.id).maybeSingle();
  return { order, claim };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNumber: string; claimId: string }> }) {
  const { orderNumber, claimId } = await params;
  const { order, claim } = await loadOrderAndClaim(orderNumber, claimId);
  if (!order || !claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const [{ data: items }, { data: evidence }, { data: timeline }, { data: returns }, { data: resolution }] = await Promise.all([
    supabaseAdmin.from("claim_items").select("id, order_item_id, product_name, item_price_usd, certificate_number").eq("claim_id", claimId),
    supabaseAdmin.from("claim_evidence").select("*").eq("claim_id", claimId).eq("customer_visible", true).order("created_at"),
    supabaseAdmin
      .from("claim_timeline_events")
      .select("id, actor_type, action, old_status, new_status, customer_note, created_at")
      .eq("claim_id", claimId)
      .not("customer_note", "is", null)
      .order("created_at"),
    supabaseAdmin.from("returns").select("*, return_shipments(*), return_inspections(result, restockable, created_at)").eq("claim_id", claimId),
    claim.resolution_id
      ? supabaseAdmin.from("claim_resolutions").select("id, resolution_type, decided_at, customer_summary").eq("id", claim.resolution_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const evidenceWithUrls = await Promise.all(
    (evidence ?? []).map(async (e) => ({ ...e, url: e.storage_path ? await resolveClaimEvidenceUrls([e.storage_path]).then((u) => u[0]) : null }))
  );

  const snapshot = claim.original_shipment_snapshot as { insurance_purchased?: boolean | null; insured_value_usd?: number | null } | null;

  return NextResponse.json({
    claim: {
      id: claim.id,
      claimNumber: claim.claim_number,
      claimType: claim.claim_type,
      claimSubtype: claim.claim_subtype,
      fitIssue: claim.fit_issue,
      status: claim.status,
      customerFacingStatus: customerFacingStatus(claim.status),
      responsibility: claim.responsibility,
      description: claim.description,
      openedAt: claim.opened_at,
      resolvedAt: claim.resolved_at,
      closedAt: claim.closed_at,
      packagingAckAt: claim.packaging_ack_at,
      insuranceMessage: claim.claim_type === "missing_package" || claim.claim_type === "damaged_item"
        ? insuranceMessage({ insurancePurchased: snapshot?.insurance_purchased ?? null, insuredValueUsd: snapshot?.insured_value_usd ?? null })
        : null,
    },
    items: items ?? [],
    evidence: evidenceWithUrls,
    timeline: (timeline ?? []).map((t) => ({ ...t, note: t.customer_note })),
    returns: returns ?? [],
    resolution: resolution ?? null,
  });
}
