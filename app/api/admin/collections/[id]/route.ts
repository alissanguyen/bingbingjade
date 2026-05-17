import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: collection, error } = await supabaseAdmin
    .from("collections")
    .select(`
      *,
      collection_scenes!collection_id (
        id, image, mobile_image, caption, sort_order,
        collection_scene_tags (
          id, x, y,
          products ( id, name, slug, images, price_display_usd, sale_price_usd, show_price, status )
        )
      ),
      collection_products (
        id, sort_order,
        products ( id, name, slug, public_id, category, images, price_display_usd, sale_price_usd, show_price, status )
      )
    `)
    .eq("id", id)
    .order("sort_order", { referencedTable: "collection_scenes" })
    .order("sort_order", { referencedTable: "collection_products" })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(collection);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    slug?: string;
    subtitle?: string | null;
    description?: string | null;
    hero_image?: string | null;
    hero_scene_id?: string | null;
    status?: "draft" | "published";
    sort_order?: number;
  };

  const { data, error } = await supabaseAdmin
    .from("collections")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin.from("collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
