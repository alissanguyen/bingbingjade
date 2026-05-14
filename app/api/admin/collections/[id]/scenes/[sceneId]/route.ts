import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type Params = { params: Promise<{ id: string; sceneId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const body = await req.json() as {
    caption?: string | null;
    sort_order?: number;
    mobile_image?: string | null;
  };

  const { data, error } = await supabaseAdmin
    .from("collection_scenes")
    .update(body)
    .eq("id", sceneId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;

  // Fetch image paths to clean up storage
  const { data: scene } = await supabaseAdmin
    .from("collection_scenes")
    .select("image, mobile_image")
    .eq("id", sceneId)
    .single();

  const { error } = await supabaseAdmin.from("collection_scenes").delete().eq("id", sceneId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort storage cleanup
  const toRemove = [scene?.image, scene?.mobile_image].filter(Boolean) as string[];
  if (toRemove.length > 0) {
    await supabaseAdmin.storage.from("jade-images").remove(toRemove).catch(() => {});
  }

  return new NextResponse(null, { status: 204 });
}
