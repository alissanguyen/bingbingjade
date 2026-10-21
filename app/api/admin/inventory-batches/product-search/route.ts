import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });

  // Search Ship Now (quick_ship) products by name (case-insensitive), SKU, or public_id
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, public_id, sku, images")
    .eq("quick_ship", true)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%,public_id.ilike.%${q}%`)
    .order("name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
