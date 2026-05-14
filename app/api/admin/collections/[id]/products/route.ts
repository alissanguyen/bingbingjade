import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: collectionId } = await params;
  const { product_id, sort_order } = await req.json() as {
    product_id: string;
    sort_order?: number;
  };

  if (!product_id)
    return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("collection_products")
    .insert({ collection_id: collectionId, product_id, sort_order: sort_order ?? 0 })
    .select(`
      id, sort_order,
      products ( id, name, slug, public_id, category, images, price_display_usd, sale_price_usd, show_price, status )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: collectionId } = await params;
  const { product_id } = await req.json() as { product_id: string };

  const { error } = await supabaseAdmin
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId)
    .eq("product_id", product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
