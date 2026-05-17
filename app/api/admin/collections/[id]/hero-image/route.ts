import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { resolveImageUrl, IMAGE_BUCKET } from "@/lib/storage";
import sharp from "sharp";
import { randomUUID } from "crypto";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "image is required" }, { status: 400 });

  const mimeType = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported format "${file.type}". Accepted: JPEG, PNG, WebP, HEIC/HEIF.` },
      { status: 422 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  try {
    processed = await sharp(buf)
      .rotate()
      .resize(2400, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unsupported|heif|heic|format/i.test(msg)) {
      return NextResponse.json(
        { error: "Could not process this image. If it is HEIC/HEIF, convert it to JPEG or PNG and try again." },
        { status: 422 }
      );
    }
    console.error("[hero-image] sharp error:", err);
    return NextResponse.json({ error: "Image processing failed." }, { status: 500 });
  }

  const path = `collection-heroes/${randomUUID()}.webp`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .upload(path, processed, { contentType: "image/webp", upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { error: dbErr } = await supabaseAdmin
    .from("collections")
    .update({ hero_image: path, hero_scene_id: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const heroImageUrl = await resolveImageUrl(path);
  return NextResponse.json({ hero_image: path, heroImageUrl }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("collections")
    .update({ hero_image: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
