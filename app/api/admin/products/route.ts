import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/approved-auth";

export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const excludeDrafts = req.nextUrl.searchParams.get("excludeDrafts") === "1";

  let query = supabaseAdmin
    .from("products")
    .select(`
      id,
      name,
      status,
      price_display_usd,
      sale_price_usd,
      images,
      product_options (
        id,
        label,
        price_usd,
        sale_price_usd,
        status
      )
    `)
    .neq("status", "archived")
    .order("name")
    .limit(5000);

  if (excludeDrafts) {
    query = query.neq("status", "draft");
  }

  const { data: products, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: products ?? [] });
}
