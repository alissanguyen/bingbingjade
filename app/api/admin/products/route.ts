import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/approved-auth";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select(`
      id,
      name,
      status,
      price_display_usd,
      images,
      product_options (
        id,
        label,
        price_usd,
        status
      )
    `)
    .eq("is_published", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: products ?? [] });
}
