import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { updateClaimStatus } from "@/lib/claims";
import { actorId } from "../route";
import { notifyCustomer } from "@/lib/claim-emails";

// Admin manually requests additional evidence (§8: "Admin must also be able
// to manually request additional evidence after submission"). Sets
// responsibility so the claim surfaces under "Waiting on Customer" in the
// queue, and shows "Action required: Upload additional photos" (or the
// custom message given) in the customer portal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as { message?: string; notify?: boolean };
  const message = body.message?.trim() || "Action required: please upload additional photos/evidence for your claim.";

  const claim = await updateClaimStatus({
    claimId,
    newStatus: "additional_evidence_requested",
    responsibility: "customer_action_required",
    actorType: "admin",
    actor: actorId(session),
    customerNote: message,
  });

  if (body.notify !== false) {
    await notifyCustomer({ claimId, templateKey: "evidence_requested", subject: `Action needed on your claim ${claim.claim_number}`, body: message, createdBy: actorId(session) });
  }

  return NextResponse.json({ claim });
}
