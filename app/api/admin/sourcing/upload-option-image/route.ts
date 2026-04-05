import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { IMAGE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: JPEG, PNG, WEBP, HEIC, PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const id  = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `sourcing-options/${id}.${ext}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("[upload-option-image] Upload failed:", uploadErr);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path });
}
