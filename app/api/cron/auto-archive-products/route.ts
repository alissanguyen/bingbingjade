/**
 * Cron: auto-archive products published for over 30 days without selling.
 * Runs daily. Sets status = 'archived' and is_published = false.
 *
 * Trigger via Vercel Cron or external scheduler:
 *   GET /api/cron/auto-archive-products
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAllRows } from "@/lib/supabase-fetch-all";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let toArchive: { id: string; name: string; published_at: string }[];
  try {
    toArchive = await fetchAllRows((from, to) =>
      supabaseAdmin
        .from("products")
        .select("id, name, published_at")
        .eq("is_published", true)
        .not("status", "in", '("sold","archived")')
        .not("published_at", "is", null)
        .lte("published_at", cutoff)
        .range(from, to)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auto-archive] Fetch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (toArchive.length === 0) {
    return NextResponse.json({ archived: 0 });
  }

  const ids = toArchive.map((p) => p.id);

  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update({ status: "archived", is_published: false })
    .in("id", ids);

  if (updateError) {
    console.error("[auto-archive] Update error:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/products");
  revalidatePath("/edit");
  revalidatePath("/products-admin");

  console.log(`[auto-archive] Archived ${ids.length} products:`, toArchive.map((p) => p.name));
  return NextResponse.json({ archived: ids.length, ids });
}
