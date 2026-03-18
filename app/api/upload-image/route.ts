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
 * Response: { path: string }  — watermarked storage path, e.g. "wm/1234-abc.jpg"
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyWatermark } from "@/lib/watermark";
import { IMAGE_BUCKET } from "@/lib/storage";

// Allow large raw image files (iPhone HEIC/RAW can be 15–20 MB)
export const maxDuration = 60; // seconds — Sharp processing can be slow on large files
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Auth: must be logged-in admin ─────────────────────────────────────────
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session || session !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // ── Process ───────────────────────────────────────────────────────────────
  try {
    const bytes = await file.arrayBuffer();
    const input = Buffer.from(bytes);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Upload original (admin/backup use; not served to customers)
    const originalPath = `originals/${id}`;
    await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(originalPath, input, { contentType: file.type, upsert: false });

    // Generate watermarked version and upload
    const watermarked = await applyWatermark(input, category);
    const wmPath = `wm/${id}.jpg`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(IMAGE_BUCKET)
      .upload(wmPath, watermarked, { contentType: "image/jpeg", upsert: false });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // Return the watermarked path — this is what gets saved to the database
    return NextResponse.json({ path: wmPath });
  } catch (err) {
    console.error("[upload-image] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
