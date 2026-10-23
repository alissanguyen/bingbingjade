import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, size, status, images")
    .eq("quick_ship", true)
    .eq("status", "available")
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .order("name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
