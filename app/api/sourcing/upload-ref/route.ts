import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { nanoid } from "nanoid";

const BUCKET = "jade-images";
const PREFIX = "sourcing-refs";
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_FILES_PER_REQUEST = 1;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg":       "jpg",
  "image/jpg":        "jpg",
  "image/png":        "png",
  "image/webp":       "webp",
  "image/heic":       "heic",
  "image/heif":       "heic",
  "application/pdf":  "pdf",
};

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }

  // Validate MIME type from what the browser reports
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: JPG, PNG, WebP, HEIC, PDF." },
      { status: 400 }
    );
  }

  // Double-check extension from filename as a secondary guard
  const originalName = file.name;
  const nameLower = originalName.toLowerCase();
  const knownExts = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];
  const hasKnownExt = knownExts.some((e) => nameLower.endsWith(`.${e}`));
  if (!hasKnownExt) {
    return NextResponse.json({ error: "Unrecognised file extension." }, { status: 400 });
  }

  const path = `${PREFIX}/${nanoid()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[sourcing/upload-ref] Upload failed:", uploadErr);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    path,
    url: urlData.publicUrl,
    originalName,
    ext,
  });
}

// Satisfy unused import lint
void MAX_FILES_PER_REQUEST;
