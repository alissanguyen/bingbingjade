import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/png",
  "image/jpeg",
]);

const ALLOWED_EXTS = new Set(["pdf", "heic", "heif", "png", "jpg", "jpeg"]);

const BUCKET = "jade-images";
const PREFIX = "expense-invoices";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, HEIC, PNG, JPG, or JPEG." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Unique filename: timestamp + random suffix
  const rand = Math.random().toString(36).slice(2, 8);
  const filename = `${PREFIX}/${Date.now()}-${rand}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename);
  return NextResponse.json({ url: data.publicUrl, path: filename });
}
