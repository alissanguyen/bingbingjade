import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_IMAGE_BUCKET } from "@/lib/storage";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// POST /api/reviews/[reviewId]/image
// Customer-facing: upload one image for an unapproved review
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params;

  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("id, is_approved, image_path")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.is_approved) return NextResponse.json({ error: "Cannot modify an approved review." }, { status: 409 });

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
    return NextResponse.json({ error: "Only jpg, png, webp images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image exceeds 5 MB limit." }, { status: 400 });
  }

  // Remove old image if one exists
  if (review.image_path) {
    await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([review.image_path]);
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
  const storagePath = `${reviewId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(REVIEW_IMAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: "Failed to upload image." }, { status: 500 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("reviews")
    .update({ image_path: storagePath })
    .eq("id", reviewId);

  if (updateErr) {
    await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Failed to save image." }, { status: 500 });
  }

  return NextResponse.json({ image_path: storagePath }, { status: 201 });
}
