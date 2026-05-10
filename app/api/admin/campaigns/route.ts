import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/slug";

// GET /api/admin/campaigns — list all campaigns with product counts
export async function GET() {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaigns, error } = await supabaseAdmin
    .from("campaign_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch product counts
  const ids = (campaigns ?? []).map((c) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("campaign_event_products")
      .select("campaign_id")
      .in("campaign_id", ids);
    (rows ?? []).forEach((r) => {
      counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1;
    });
  }

  return NextResponse.json(
    (campaigns ?? []).map((c) => ({ ...c, product_count: counts[c.id] ?? 0 }))
  );
}

// POST /api/admin/campaigns — create a new campaign event
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    slug?: string;
    category?: string;
    description?: string | null;
    banner_message?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    status?: string;
    discount_type?: "fixed" | "percent" | null;
    discount_value?: number | null;
    coupon_code?: string | null;
    allow_coupon_stack?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
  if (!body.category) return NextResponse.json({ error: "category is required." }, { status: 400 });

  const slug = body.slug?.trim() || slugify(name);
  const couponCode = body.coupon_code?.trim().toUpperCase() || null;

  const { data, error } = await supabaseAdmin
    .from("campaign_events")
    .insert({
      name,
      slug,
      category: body.category,
      description: body.description?.trim() || null,
      banner_message: body.banner_message?.trim() || null,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      status: body.status ?? "draft",
      discount_type: body.discount_type ?? null,
      discount_value: body.discount_value ?? null,
      coupon_code: couponCode,
      allow_coupon_stack: body.allow_coupon_stack ?? false,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "A campaign with this slug already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
