/**
 * POST /api/image/record-original
 *
 * Two modes:
 *
 * Mode A — new local file (multipart/form-data):
 *   file      — the original image file
 *   sku       — the 8-digit product SKU
 *   vendor_id — (optional) vendor UUID
 *   Uploads the file to originals/ bucket and inserts a row in product_original_images.
 *
 * Mode B — existing Supabase image (application/json):
 *   wmUrl     — the wm/ signed URL of an image already in storage
 *   sku       — the 8-digit product SKU
 *   vendor_id — (optional) vendor UUID
 *   Derives the originals/ path from the wm/ URL and inserts a DB row only
 *   (the file is already in originals/ from when it was first uploaded).
 *
 * Response: { ok: true } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { IMAGE_BUCKET, toStoragePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

// "wm/1712345678-abc123.jpg" → "originals/1712345678-abc123"
function wmPathToOriginalPath(wmPath: string): string {
  const file = wmPath.replace(/^wm\//, "");
  const stem = file.replace(/\.[^.]+$/, "");
  return `originals/${stem}`;
}

export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ── Mode B: existing Supabase image — just record the DB row ─────────────
  if (contentType.includes("application/json")) {
    let body: { wmUrl?: string; sku?: string; vendor_id?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { wmUrl, sku, vendor_id } = body;
    if (!wmUrl || !sku) {
      return NextResponse.json({ error: "wmUrl and sku are required" }, { status: 400 });
    }

    const storagePath = toStoragePath(wmUrl);
    if (!storagePath.startsWith("wm/")) {
      return NextResponse.json({ error: "wmUrl does not resolve to a wm/ path" }, { status: 400 });
    }

    const originalPath = wmPathToOriginalPath(storagePath);

    const { error: dbErr } = await supabaseAdmin
      .from("product_original_images")
      .insert({ sku, original_storage_path: originalPath, vendor_id: vendor_id || null });

    if (dbErr) {
      console.warn("[record-original] DB insert failed:", dbErr.message);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── Mode A: new local file — upload to originals/ then record ────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const sku = (formData.get("sku") as string | null)?.trim();
  const vendor_id = (formData.get("vendor_id") as string | null)?.trim() || null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!sku)  return NextResponse.json({ error: "sku is required" }, { status: 400 });

  try {
    const bytes = await file.arrayBuffer();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const originalPath = `originals/${id}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(originalPath, Buffer.from(bytes), { contentType: file.type, upsert: false });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { error: dbErr } = await supabaseAdmin
      .from("product_original_images")
      .insert({ sku, original_storage_path: originalPath, vendor_id });

    if (dbErr) {
      console.warn("[record-original] DB insert failed:", dbErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[record-original] error:", err);
    return NextResponse.json({ error: "Failed to record original" }, { status: 500 });
  }
}
