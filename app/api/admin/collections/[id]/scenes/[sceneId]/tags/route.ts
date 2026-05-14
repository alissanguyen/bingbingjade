import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type Params = { params: Promise<{ sceneId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const { product_id, x, y } = await req.json() as {
    product_id: string;
    x: number;
    y: number;
  };

  if (!product_id || x == null || y == null)
    return NextResponse.json({ error: "product_id, x, y required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("collection_scene_tags")
    .insert({ scene_id: sceneId, product_id, x, y })
    .select(`
      id, x, y,
      products ( id, name, slug, images, price_display_usd, sale_price_usd, show_price, status )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const { tagId } = await req.json() as { tagId: string };

  const { error } = await supabaseAdmin
    .from("collection_scene_tags")
    .delete()
    .eq("id", tagId)
    .eq("scene_id", sceneId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
