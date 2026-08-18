import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { reopenClaim } from "@/lib/claims";
import { actorId } from "../route";

export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as { reason?: string };
  if (!body.reason?.trim()) return NextResponse.json({ error: "reason is required to reopen a claim" }, { status: 400 });

  const claim = await reopenClaim({ claimId, admin: actorId(session), reason: body.reason.trim() });
  return NextResponse.json({ claim });
}
