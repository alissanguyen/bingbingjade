import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import sharp from "sharp";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: collectionId } = await params;

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  const mobileFile = formData.get("mobile_image") as File | null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  const sortOrder = parseInt(formData.get("sort_order") as string ?? "0", 10) || 0;

  if (!file) return NextResponse.json({ error: "image is required" }, { status: 400 });

  async function uploadImage(f: File, prefix: string): Promise<string> {
    const buf = Buffer.from(await f.arrayBuffer());
    const processed = await sharp(buf)
      .rotate()
      .resize(2400, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const path = `collection-scenes/${prefix}${randomUUID()}.webp`;
    const { error } = await supabaseAdmin.storage
      .from("jade-images")
      .upload(path, processed, { contentType: "image/webp", upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  const imagePath = await uploadImage(file, "");
  const mobilePath = mobileFile ? await uploadImage(mobileFile, "m-") : null;

  const { data: scene, error } = await supabaseAdmin
    .from("collection_scenes")
    .insert({
      collection_id: collectionId,
      image: imagePath,
      mobile_image: mobilePath,
      caption,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(scene, { status: 201 });
}
