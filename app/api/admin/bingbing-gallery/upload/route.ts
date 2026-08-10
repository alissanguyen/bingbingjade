import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { applyWatermark } from "@/lib/watermark";
import { BINGBING_GALLERY_BUCKET, bingbingGalleryPublicUrl } from "@/lib/storage";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB raw — matches other upload routes' iPhone-original allowance

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const mimeType = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported format "${file.type}". Accepted: JPEG, PNG, WebP, HEIC/HEIF.` },
      { status: 422 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is too large (20MB max)." }, { status: 422 });
  }

  const xPercent = Number(formData.get("xPercent"));
  const yPercent = Number(formData.get("yPercent"));
  if (!Number.isFinite(xPercent) || !Number.isFinite(yPercent) || xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) {
    return NextResponse.json({ error: "xPercent and yPercent must be numbers between 0 and 100." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let watermarked: Buffer;
  try {
    watermarked = await applyWatermark(buf, "", { xPercent, yPercent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unsupported|heif|heic|format/i.test(msg)) {
      return NextResponse.json(
        { error: "Could not process this image. If it is HEIC/HEIF, convert it to JPEG or PNG and try again." },
        { status: 422 }
      );
    }
    console.error("[bingbing-gallery/upload] watermark error:", err);
    return NextResponse.json({ error: "Image processing failed." }, { status: 500 });
  }

  const path = `${randomUUID()}.webp`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BINGBING_GALLERY_BUCKET)
    .upload(path, watermarked, { contentType: "image/webp", upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: maxRow } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: row, error: dbErr } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .insert({ storage_path: path, logo_x: xPercent, logo_y: yPercent, sort_order: nextSortOrder })
    .select("*")
    .single();
  if (dbErr || !row) {
    return NextResponse.json({ error: dbErr?.message ?? "Failed to save gallery image." }, { status: 500 });
  }

  return NextResponse.json({ image: { ...row, url: bingbingGalleryPublicUrl(row.storage_path) } }, { status: 201 });
}
