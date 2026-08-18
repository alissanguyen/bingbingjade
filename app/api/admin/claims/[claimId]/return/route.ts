import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createReturn, setReturnDeadline } from "@/lib/claims";
import { actorId } from "../route";

// POST — approve a return / open the return object for a claim (§10, §11).
// Custom per-return drop-off deadline, no hardcoded default.
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as {
    returnType?: "damage_insurance_return" | "not_as_described" | "sizing_refund" | "sizing_exchange";
    dropoffDeadlineAt?: string;
    expectedComponents?: Array<{ component: string; required: boolean; customerAllowedToKeep: boolean }>;
  };
  if (!body.returnType) return NextResponse.json({ error: "returnType required" }, { status: 400 });

  const { data: claim } = await supabaseAdmin.from("claims").select("order_id").eq("id", claimId).maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const ret = await createReturn({
    claimId,
    orderId: claim.order_id,
    returnType: body.returnType,
    expectedComponents: body.expectedComponents ?? [
      { component: "original_box", required: true, customerAllowedToKeep: false },
      { component: "certificate", required: true, customerAllowedToKeep: false },
      { component: "pouch", required: true, customerAllowedToKeep: false },
    ],
    dropoffDeadlineAt: body.dropoffDeadlineAt ?? null,
  });

  return NextResponse.json({ return: ret }, { status: 201 });
}

// PATCH — extend/change the drop-off deadline. Always audit logged (§11).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as { returnId?: string; newDeadline?: string; reason?: string };
  if (!body.returnId || !body.newDeadline) return NextResponse.json({ error: "returnId and newDeadline required" }, { status: 400 });

  await setReturnDeadline({ returnId: body.returnId, claimId, newDeadline: body.newDeadline, admin: actorId(session), reason: body.reason ?? null });
  return NextResponse.json({ ok: true });
}
