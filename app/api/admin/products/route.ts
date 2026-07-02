import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAllRows } from "@/lib/supabase-fetch-all";
import { getSessionUser } from "@/lib/approved-auth";

export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const excludeDrafts = req.nextUrl.searchParams.get("excludeDrafts") === "1";

  try {
    // admin product picker — batched fetch so the Supabase 1000-row cap is never hit
    const products = await fetchAllRows((from, to) => {
      let q = supabaseAdmin
        .from("products")
        .select(`id, name, status, price_display_usd, sale_price_usd, images, product_options(id, label, price_usd, sale_price_usd, status)`)
        .neq("status", "archived")
        .order("name")
        .range(from, to);
      if (excludeDrafts) q = q.neq("status", "draft");
      return q;
    });
    return NextResponse.json({ products });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
