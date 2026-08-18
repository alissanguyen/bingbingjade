import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { recordReturnLabel, recordCarrierAcceptance } from "@/lib/claims";
import { actorId } from "../../route";

// POST — record a prepaid return label. Admin-generated-elsewhere or
// manually entered — no carrier API integration exists in this codebase
// (§10: "admin must be able to generate OR upload"), so this is a
// structured record, not an automated purchase.
export async function POST(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as {
    returnId?: string; carrier?: string; serviceLevel?: string; trackingNumber?: string;
    labelStoragePath?: string; labelExternalUrl?: string; labelExpiresAt?: string;
    quotedLabelCostCents?: number; insurancePurchased?: boolean; insuredValueUsd?: number;
    insurancePremiumUsd?: number; costBorneBy?: "bbj" | "customer"; deductFromRefund?: boolean;
  };
  if (!body.returnId || !body.carrier) return NextResponse.json({ error: "returnId and carrier required" }, { status: 400 });

  const label = await recordReturnLabel({
    returnId: body.returnId, claimId, admin: actorId(session), carrier: body.carrier,
    serviceLevel: body.serviceLevel ?? null, trackingNumber: body.trackingNumber ?? null,
    labelStoragePath: body.labelStoragePath ?? null, labelExternalUrl: body.labelExternalUrl ?? null,
    labelExpiresAt: body.labelExpiresAt ?? null, quotedLabelCostCents: body.quotedLabelCostCents ?? 0,
    insurancePurchased: body.insurancePurchased, insuredValueUsd: body.insuredValueUsd ?? null,
    insurancePremiumUsd: body.insurancePremiumUsd ?? null, costBorneBy: body.costBorneBy,
    deductFromRefund: body.deductFromRefund,
  });

  return NextResponse.json({ returnShipment: label }, { status: 201 });
}

// PATCH — confirm carrier acceptance scan (objective evidence, §11).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { claimId } = await params;
  const body = await req.json().catch(() => ({})) as { returnShipmentId?: string; returnId?: string; scanAt?: string };
  if (!body.returnShipmentId || !body.returnId) return NextResponse.json({ error: "returnShipmentId and returnId required" }, { status: 400 });

  await recordCarrierAcceptance({ returnShipmentId: body.returnShipmentId, returnId: body.returnId, claimId, admin: actorId(session), scanAt: body.scanAt });
  return NextResponse.json({ ok: true });
}
