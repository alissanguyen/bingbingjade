import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_IMAGE_BUCKET, reviewImagePublicUrl } from "@/lib/storage";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

// POST /api/admin/reviews/[id]/images
// Admin-only — bypasses is_approved check so images can be added to seeded/approved reviews
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const files = formData.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ images: [] });
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images per upload.` }, { status: 400 });
  }

  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: `${file.name}: only jpg, png, webp allowed.` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `${file.name}: exceeds 5 MB limit.` }, { status: 400 });
    }
  }

  // Get current image count to set sort_order correctly
  const { count: existingCount } = await supabaseAdmin
    .from("review_images")
    .select("id", { count: "exact", head: true })
    .eq("review_id", id);

  const startOrder = existingCount ?? 0;
  const uploaded: { id: string; image_path: string; sort_order: number; image_url: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
    const storagePath = `${id}/${Date.now()}-${i}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadErr) {
      console.error("[admin review-images] upload failed:", uploadErr.message);
      return NextResponse.json({ error: `Failed to upload ${file.name}.` }, { status: 500 });
    }

    const { data: imgRecord, error: insertErr } = await supabaseAdmin
      .from("review_images")
      .insert({ review_id: id, image_path: storagePath, sort_order: startOrder + i })
      .select("id, image_path, sort_order")
      .single();

    if (insertErr || !imgRecord) {
      await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to save image record." }, { status: 500 });
    }

    uploaded.push({ ...imgRecord, image_url: reviewImagePublicUrl(imgRecord.image_path) });
  }

  return NextResponse.json({ images: uploaded }, { status: 201 });
}

// DELETE /api/admin/reviews/[id]/images?imageId=<uuid>
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const imageId = req.nextUrl.searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "imageId required." }, { status: 400 });
  }

  const { data: img } = await supabaseAdmin
    .from("review_images")
    .select("id, image_path")
    .eq("id", imageId)
    .eq("review_id", id)
    .maybeSingle();

  if (!img) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  await supabaseAdmin.from("review_images").delete().eq("id", imageId);
  await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([img.image_path]);

  return NextResponse.json({ ok: true });
}
