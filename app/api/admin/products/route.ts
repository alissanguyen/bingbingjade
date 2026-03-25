import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select(`
      id,
      name,
      status,
      price_display_usd,
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
