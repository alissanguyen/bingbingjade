import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveImageUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, public_id, category, price_display_usd, sale_price_usd, show_price, status, images")
    .eq("is_published", true)
    .ilike("name", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(6);

  const results = await Promise.all(
    (data ?? []).map(async (p) => {
      const rawImage = Array.isArray(p.images) ? (p.images[0] ?? null) : null;
      const image = rawImage ? await resolveImageUrl(rawImage) : null;
      return {
        id: p.id,
        name: p.name,
        slug: `${p.slug}-${p.public_id}`,
        category: p.category,
        price: p.show_price ? (p.status === "on_sale" ? p.sale_price_usd : p.price_display_usd) : null,
        image,
        onSale: p.status === "on_sale",
        sold: p.status === "sold",
      };
    })
  );

  return NextResponse.json({ results });
}
