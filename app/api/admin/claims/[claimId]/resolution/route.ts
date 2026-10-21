import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClaimResolution, issueClaimCashRefund, issueClaimCredit, updateClaimStatus, type ResolutionType } from "@/lib/claims";
import { actorId } from "../route";
import { notifyCustomer } from "@/lib/claim-emails";

// POST — decide + issue a claim resolution in one call. Supports
// combination resolutions (§15): pass both `refund` and `credit` and both
// financial events get recorded against the same resolution.
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as {
    resolutionType?: ResolutionType;
    customerSummary?: string;
    internalNotes?: string;
    notify?: boolean;
    refund?: { amountCents: number; method: "stripe" | "zelle" | "ach" | "wire" | "check" | "cash" | "other"; referenceNumber?: string; adminNotes?: string };
    credit?: { amountCents: number; kind: "store_credit" | "exchange_credit"; customerMessage?: string };
  };
  if (!body.resolutionType) return NextResponse.json({ error: "resolutionType required" }, { status: 400 });
  if (!body.refund && !body.credit) return NextResponse.json({ error: "At least one of refund or credit is required (use resolutionType 'denied' with neither for a denial)." }, { status: 400 });

  const { data: claim } = await supabaseAdmin.from("claims").select("order_id, customer_email, customer_id, orders(stripe_payment_intent_id)").eq("id", claimId).maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const admin = actorId(session);
  const resolution = await createClaimResolution({
    claimId, resolutionType: body.resolutionType, decidedBy: admin,
    customerSummary: body.customerSummary ?? null, internalNotes: body.internalNotes ?? null,
  });

  if (body.refund) {
    await issueClaimCashRefund({
      claimId, orderId: claim.order_id, resolutionId: resolution.id,
      amountCents: body.refund.amountCents, method: body.refund.method,
      stripePaymentIntentId: (claim.orders as unknown as { stripe_payment_intent_id: string | null })?.stripe_payment_intent_id ?? null,
      referenceNumber: body.refund.referenceNumber ?? null, initiatedBy: admin, adminNotes: body.refund.adminNotes ?? null,
    });
  }
  if (body.credit) {
    await issueClaimCredit({
      claimId, orderId: claim.order_id, resolutionId: resolution.id,
      customerEmail: claim.customer_email, customerId: claim.customer_id,
      amountCents: body.credit.amountCents, kind: body.credit.kind,
      issuedBy: admin, customerMessage: body.credit.customerMessage ?? null,
    });
  }

  const updated = await updateClaimStatus({
    claimId, newStatus: "resolution_issued", responsibility: "closed", actorType: "admin", actor: admin,
    customerNote: body.customerSummary ?? "A resolution has been issued for your claim.",
  });

  if (body.notify !== false) {
    await notifyCustomer({ claimId, templateKey: "resolution_issued", subject: `Resolution issued for your claim ${updated.claim_number}`, body: body.customerSummary ?? "A resolution has been issued for your claim. Please check your claim page for details.", createdBy: admin });
  }

  return NextResponse.json({ claim: updated, resolution });
}
