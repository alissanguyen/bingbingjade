import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClaimEvidenceUploadUrl } from "@/lib/storage";
import { addClaimEvidence, type EvidenceCategory } from "@/lib/claims";

async function claimBelongsToOrder(orderNumber: string, claimId: string) {
  const { data: order } = await supabaseAdmin.from("orders").select("id, customer_email").eq("order_number", orderNumber).maybeSingle();
  if (!order) return null;
  const { data: claim } = await supabaseAdmin.from("claims").select("id").eq("id", claimId).eq("order_id", order.id).maybeSingle();
  return claim ? order : null;
}

// Step 1: request a signed direct-upload URL (mirrors /api/create-upload-url,
// but for an unauthenticated customer scoped to their own claim).
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNumber: string; claimId: string }> }) {
  const { orderNumber, claimId } = await params;
  const order = await claimBelongsToOrder(orderNumber, claimId);
  if (!order) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  let body: { mode?: "upload-url"; filename?: string; category?: EvidenceCategory; storagePath?: string; contentType?: string; caption?: string; claimItemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.mode === "upload-url") {
    if (!body.filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
    const ext = body.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${claimId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const signed = await createClaimEvidenceUploadUrl(path);
    if (!signed) return NextResponse.json({ error: "Failed to create upload URL." }, { status: 500 });
    return NextResponse.json({ signedUrl: signed.signedUrl, token: signed.token, path });
  }

  // Register mode — file already PUT to storage, now record it.
  if (!body.storagePath || !body.category) {
    return NextResponse.json({ error: "storagePath and category required" }, { status: 400 });
  }
  const evidence = await addClaimEvidence({
    claimId,
    claimItemId: body.claimItemId ?? null,
    uploadedByType: "customer",
    uploadedBy: order.customer_email ?? "customer",
    category: body.category,
    storagePath: body.storagePath,
    fileName: body.filename ?? null,
    contentType: body.contentType ?? null,
    caption: body.caption ?? null,
  });

  return NextResponse.json({ evidence }, { status: 201 });
}
