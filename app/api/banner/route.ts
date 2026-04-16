import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/banner — public, returns active banner config (or {is_active:false})
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("site_banners")
      .select("is_active, template, target_date, background")
      .eq("id", "main")
      .maybeSingle();

    if (!data?.is_active) {
      return NextResponse.json({ is_active: false }, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
      });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=15" },
    });
  } catch {
    return NextResponse.json({ is_active: false });
  }
}
