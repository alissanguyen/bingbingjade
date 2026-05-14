import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type Params = { params: Promise<{ sceneId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const { product_id, x, y, mobile_x, mobile_y } = await req.json() as {
    product_id: string;
    x: number;
    y: number;
    mobile_x?: number | null;
    mobile_y?: number | null;
  };

  if (!product_id || x == null || y == null)
    return NextResponse.json({ error: "product_id, x, y required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("collection_scene_tags")
    .insert({ scene_id: sceneId, product_id, x, y, mobile_x: mobile_x ?? null, mobile_y: mobile_y ?? null })
    .select(`
      id, x, y, mobile_x, mobile_y,
      products ( id, name, slug, images, price_display_usd, sale_price_usd, show_price, status )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneId } = await params;
  const body = await req.json() as {
    tagId: string;
    x?: number;
    y?: number;
    mobile_x?: number | null;
    mobile_y?: number | null;
  };

  const { tagId, ...fields } = body;
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 });

  const update: Record<string, number | null> = {};
  if (fields.x != null) update.x = fields.x;
  if (fields.y != null) update.y = fields.y;
  if ("mobile_x" in fields) update.mobile_x = fields.mobile_x ?? null;
  if ("mobile_y" in fields) update.mobile_y = fields.mobile_y ?? null;

  const { data, error } = await supabaseAdmin
    .from("collection_scene_tags")
    .update(update)
    .eq("id", tagId)
    .eq("scene_id", sceneId)
    .select("id, x, y, mobile_x, mobile_y")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
