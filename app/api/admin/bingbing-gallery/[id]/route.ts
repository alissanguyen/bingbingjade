import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { BINGBING_GALLERY_BUCKET } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { sort_order?: number; published?: boolean };
  const update: Record<string, unknown> = {};
  if (typeof body.sort_order === "number") update.sort_order = body.sort_order;
  if (typeof body.published === "boolean") update.published = body.published;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

  return NextResponse.json({ image: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const { data: row } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("bingbing_gallery_images").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (row?.storage_path) {
    await supabaseAdmin.storage.from(BINGBING_GALLERY_BUCKET).remove([row.storage_path]);
  }

  return new NextResponse(null, { status: 204 });
}
