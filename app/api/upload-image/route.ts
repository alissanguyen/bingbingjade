/**
 * POST /api/upload-image
 *
 * Receives a product image file, applies the logo watermark, uploads both
 * the original and watermarked versions to the private jade-images bucket,
 * and returns the storage path of the watermarked version.
 *
 * The frontend stores this path (not a URL) in the database. The product
 * page resolves it to a signed URL at render time.
 *
 * Auth: requires the admin_session cookie (same session used by /add and /edit).
 *
 * Body: multipart/form-data with:
 *   file — the image file
 *
 * Response: { path: string }  — optimized watermarked storage path, e.g. "wm/1234-abc.webp"
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyWatermark } from "@/lib/watermark";
import { IMAGE_BUCKET, EMPLOYEE_DRAFT_BUCKET } from "@/lib/storage";
import { getSessionUser, isCatalogContributor } from "@/lib/approved-auth";

// Allow large raw image files (iPhone HEIC/RAW can be 15–20 MB)
export const maxDuration = 60; // seconds — Sharp processing can be slow on large files
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Auth: admin or approved user ──────────────────────────────────────────
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Catalog contributors never write to the public jade-images bucket —
  // their uploads go to the private draft bucket and are only promoted to
  // jade-images by an admin publish action.
  const isEmployee = isCatalogContributor(session);
  const imageBucket = isEmployee ? EMPLOYEE_DRAFT_BUCKET : IMAGE_BUCKET;

  // ── Parse multipart body ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const category = (formData.get("category") as string | null) ?? "";
  const sku = (formData.get("sku") as string | null) ?? "";

  // ── Process ───────────────────────────────────────────────────────────────
  try {
    const bytes = await file.arrayBuffer();
    const input = Buffer.from(bytes);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Upload original (admin/backup use; not served to customers). Skipped
    // for employee drafts — nothing in that bucket is ever public, so a
    // separate "original" copy serves no purpose there.
    const originalPath = `originals/${id}`;
    if (!isEmployee) {
      await supabaseAdmin.storage
        .from(imageBucket)
        .upload(originalPath, input, { contentType: file.type, upsert: false });
    }

    // Generate optimized watermarked WebP. Applied for employee drafts too,
    // so the preview an employee/admin sees during review already matches
    // what gets published — promotion is then a plain byte copy.
    const watermarked = await applyWatermark(input, category);
    const wmPath = `wm/${id}.webp`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(imageBucket)
      .upload(wmPath, watermarked, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // ── Record original in product_original_images (keyed by product SKU) ─
    if (sku && !isEmployee) {
      const { error: originErr } = await supabaseAdmin
        .from("product_original_images")
        .insert({ sku, original_storage_path: originalPath });
      if (originErr) {
        // Non-fatal — log but don't fail the upload
        console.warn("[upload-image] product_original_images insert failed:", originErr.message);
      }
    }

    // Return the watermarked path — this is what gets saved to the database
    return NextResponse.json({ path: wmPath });
  } catch (err) {
    console.error("[upload-image] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
