import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_IMAGE_BUCKET } from "@/lib/storage";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES = 5;

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(REVIEW_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME,
  });
  // Ignore "already exists" — bucket was already created
  if (error && !error.message.toLowerCase().includes("already exist")) {
    console.error("[review-images] bucket create error:", error.message);
  }
}

// POST /api/reviews/[reviewId]/images
// FormData: up to 5 "image" file entries
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params;

  // Verify review exists and is not yet approved
  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("id, is_approved")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  if (review.is_approved) {
    return NextResponse.json({ error: "Cannot add images to an already-approved review." }, { status: 409 });
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
    return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed.` }, { status: 400 });
  }

  // Validate each file
  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: `${file.name}: only jpg, png, webp images are allowed.` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `${file.name}: exceeds 5 MB limit.` }, { status: 400 });
    }
  }

  await ensureBucket();

  const uploaded: { id: string; image_path: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
    const safeName = `${Date.now()}-${i}.${ext}`;
    const storagePath = `${reviewId}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[review-images] upload failed:", uploadErr.message);
      return NextResponse.json({ error: `Failed to upload ${file.name}.` }, { status: 500 });
    }

    const { data: imgRecord, error: insertErr } = await supabaseAdmin
      .from("review_images")
      .insert({ review_id: reviewId, image_path: storagePath, sort_order: i })
      .select("id, image_path")
      .single();

    if (insertErr || !imgRecord) {
      console.error("[review-images] db insert failed:", insertErr?.message);
      // Clean up the uploaded file
      await supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to save image record." }, { status: 500 });
    }

    uploaded.push(imgRecord);
  }

  return NextResponse.json({ images: uploaded }, { status: 201 });
}
