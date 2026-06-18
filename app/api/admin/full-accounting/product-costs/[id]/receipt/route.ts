import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { IMAGE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("receipt") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Remove any previous receipt first
  const { data: existing } = await supabaseAdmin
    .from("product_costs")
    .select("receipt_storage_path")
    .eq("id", id)
    .single();

  if (existing?.receipt_storage_path) {
    await supabaseAdmin.storage.from(IMAGE_BUCKET).remove([existing.receipt_storage_path]);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `receipts/product-costs/${id}/${Date.now()}_${safeName}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, Buffer.from(buffer), { contentType: file.type || "application/octet-stream", upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { error: dbErr } = await supabaseAdmin
    .from("product_costs")
    .update({ receipt_storage_path: storagePath })
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);

  return NextResponse.json({ receipt_storage_path: storagePath, url: urlData.publicUrl });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: cost } = await supabaseAdmin
    .from("product_costs")
    .select("receipt_storage_path")
    .eq("id", id)
    .single();

  if (cost?.receipt_storage_path) {
    await supabaseAdmin.storage.from(IMAGE_BUCKET).remove([cost.receipt_storage_path]);
  }

  await supabaseAdmin.from("product_costs").update({ receipt_storage_path: null }).eq("id", id);

  return new NextResponse(null, { status: 204 });
}
