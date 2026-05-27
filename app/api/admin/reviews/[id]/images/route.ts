import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_IMAGE_BUCKET, reviewImagePublicUrl } from "@/lib/storage";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// POST /api/admin/reviews/[id]/images — upload (or replace) the single review image
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("id, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `${file.name}: only jpg, png, webp allowed.` }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `${file.name}: exceeds 5 MB limit.` }, { status: 400 });
  }

  // Remove old image if one exists
  if (review.image_path) {
    await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([review.image_path]);
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
  const storagePath = `${id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(REVIEW_IMAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: `Failed to upload image.` }, { status: 500 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("reviews")
    .update({ image_path: storagePath })
    .eq("id", id);

  if (updateErr) {
    await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Failed to save image record." }, { status: 500 });
  }

  return NextResponse.json({
    image_path: storagePath,
    image_url: reviewImagePublicUrl(storagePath),
  }, { status: 201 });
}

// DELETE /api/admin/reviews/[id]/images — remove the review image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("id, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (!review.image_path) return NextResponse.json({ ok: true });

  await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([review.image_path]);
  await supabaseAdmin.from("reviews").update({ image_path: null }).eq("id", id);

  return NextResponse.json({ ok: true });
}
