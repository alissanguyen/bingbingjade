import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { updateClaimStatus, type Responsibility } from "@/lib/claims";
import { actorId } from "../route";
import { notifyCustomer } from "@/lib/claim-emails";

export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as {
    newStatus?: string; responsibility?: Responsibility; customerNote?: string; internalNote?: string;
    assignedAdmin?: string; nextAction?: string; nextActionDueAt?: string; notify?: boolean;
  };
  if (!body.newStatus) return NextResponse.json({ error: "newStatus required" }, { status: 400 });

  const claim = await updateClaimStatus({
    claimId,
    newStatus: body.newStatus,
    responsibility: body.responsibility,
    actorType: "admin",
    actor: actorId(session),
    customerNote: body.customerNote ?? null,
    internalNote: body.internalNote ?? null,
    assignedAdmin: body.assignedAdmin,
    nextAction: body.nextAction,
    nextActionDueAt: body.nextActionDueAt,
  });

  if (body.notify && body.customerNote) {
    await notifyCustomer({ claimId, templateKey: "status_update", subject: `Update on your claim ${claim.claim_number}`, body: body.customerNote, createdBy: actorId(session) });
  }

  return NextResponse.json({ claim });
}
