import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin, approvedCreatedBy } from "@/lib/approved-auth";
import { resolveClaimEvidenceUrls } from "@/lib/storage";
import { getClaimFinancialSummary } from "@/lib/claims";

export function actorId(session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>): string {
  return session.type === "admin" ? "admin" : approvedCreatedBy(session.user.id);
}

// GET — full admin claim detail: everything the customer view withholds
// (internal notes, evidence, COGS, vendor reimbursements, financial ledger).
export async function GET(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const { data: claim } = await supabaseAdmin
    .from("claims")
    .select("*, orders(order_number, customer_name, customer_email, stripe_payment_intent_id, amount_total)")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const [
    { data: items }, { data: evidence }, { data: timeline }, { data: returns },
    { data: carrierCases }, { data: insuranceClaims }, { data: vendorReimbursements },
    { data: resolutions }, financialSummary, { data: communications },
  ] = await Promise.all([
    supabaseAdmin.from("claim_items").select("*").eq("claim_id", claimId),
    supabaseAdmin.from("claim_evidence").select("*").eq("claim_id", claimId).order("created_at"),
    supabaseAdmin.from("claim_timeline_events").select("*").eq("claim_id", claimId).order("created_at"),
    supabaseAdmin.from("returns").select("*, return_shipments(*), return_inspections(*)").eq("claim_id", claimId),
    supabaseAdmin.from("carrier_cases").select("*").eq("claim_id", claimId),
    supabaseAdmin.from("insurance_claims").select("*").eq("claim_id", claimId),
    supabaseAdmin.from("vendor_reimbursements").select("*").eq("claim_id", claimId),
    supabaseAdmin.from("claim_resolutions").select("*, claim_refunds(*)").eq("claim_id", claimId),
    getClaimFinancialSummary(claimId),
    supabaseAdmin.from("claim_communications").select("*").eq("claim_id", claimId).order("sent_at", { ascending: false }),
  ]);

  const evidenceWithUrls = await Promise.all(
    (evidence ?? []).map(async (e) => ({ ...e, url: e.storage_path ? await resolveClaimEvidenceUrls([e.storage_path]).then((u) => u[0]) : null }))
  );

  return NextResponse.json({
    claim,
    items: items ?? [],
    evidence: evidenceWithUrls,
    timeline: timeline ?? [],
    returns: returns ?? [],
    carrierCases: carrierCases ?? [],
    insuranceClaims: insuranceClaims ?? [],
    vendorReimbursements: vendorReimbursements ?? [],
    resolutions: resolutions ?? [],
    financialSummary,
    communications: communications ?? [],
    // Dispute fields live directly on `claims` (set by admin or a future
    // Stripe webhook handler) — not fetched live from Stripe on every page
    // load to avoid an extra round trip.
    stripeDispute: {
      hasDispute: claim.has_stripe_dispute,
      disputeId: claim.stripe_dispute_id,
      status: claim.stripe_dispute_status,
      amountCents: claim.stripe_dispute_amount_cents,
    },
  });
}
