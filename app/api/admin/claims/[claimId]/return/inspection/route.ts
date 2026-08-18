import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { recordReturnInspection, restockInspectedItem } from "@/lib/claims";
import { actorId } from "../../route";

// POST — record the return inspection (§13). Restocking, if applicable, is
// a deliberate separate follow-up call (restock=true), never automatic.
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as Parameters<typeof recordReturnInspection>[0] & { restockProductId?: string };
  if (!body.returnId || !body.result) return NextResponse.json({ error: "returnId and result required" }, { status: 400 });

  const inspection = await recordReturnInspection({ ...body, claimId, admin: actorId(session) });

  if (body.restockProductId && (body.result === "approved_as_received" || body.result === "approved_with_deduction")) {
    await restockInspectedItem({ productId: body.restockProductId, admin: actorId(session), claimId });
  }

  return NextResponse.json({ inspection }, { status: 201 });
}
