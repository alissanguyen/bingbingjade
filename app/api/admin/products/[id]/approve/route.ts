import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: "approve" | "dismiss" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "dismiss") {
    return NextResponse.json({ error: "action must be 'approve' or 'dismiss'." }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("pending_approval, pending_data")
    .eq("id", id)
    .single();

  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (!product.pending_approval) {
    return NextResponse.json({ error: "Product has no pending action." }, { status: 400 });
  }

  const isEdit = product.pending_data !== null;

  if (body.action === "approve") {
    if (isEdit) {
      // Apply proposed changes to live columns
      const { options_json, ...fields } = product.pending_data as Record<string, unknown>;
      const { error } = await supabaseAdmin
        .from("products")
        .update({ ...fields, pending_approval: false, pending_data: null })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Replace options if included in pending_data
      if (options_json && typeof options_json === "string") {
        try {
          const opts = JSON.parse(options_json) as Array<{
            label: string; size: string; price: string; status: string; images?: string[];
          }>;
          await supabaseAdmin.from("product_options").delete().eq("product_id", id);
          if (opts.length > 0) {
            await supabaseAdmin.from("product_options").insert(
              opts.map((o, i) => ({
                product_id: id,
                label: o.label || null,
                size: o.size ? Number(o.size) : null,
                price_usd: o.price ? Number(o.price) : null,
                images: o.images ?? [],
                status: o.status || "available",
                sort_order: i,
              }))
            );
          }
        } catch { /* non-fatal — options stay as-is */ }
      }
    } else {
      // New listing — clear the flag; product stays as draft for admin to publish
      const { error } = await supabaseAdmin
        .from("products")
        .update({ pending_approval: false })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // dismiss
    if (isEdit) {
      // Discard proposed changes — live data already untouched
      const { error } = await supabaseAdmin
        .from("products")
        .update({ pending_approval: false, pending_data: null })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // New listing — delete entirely
      const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
