import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// POST — add an option to an attempt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { attemptId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, status, sourcing_request_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "draft") {
    return NextResponse.json({ error: "Can only add options to a draft attempt." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const priceCents = typeof body.price_cents === "number" ? Math.floor(body.price_cents) : null;
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!priceCents || priceCents <= 0) return NextResponse.json({ error: "Price must be positive." }, { status: 400 });

  // Get current max sort_order for this attempt
  const { data: existing } = await supabaseAdmin
    .from("sourcing_attempt_options")
    .select("sort_order")
    .eq("attempt_id", attemptId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sortOrder = existing?.length ? (existing[0].sort_order ?? 0) + 1 : 0;

  const { data: option, error: insertErr } = await supabaseAdmin
    .from("sourcing_attempt_options")
    .insert({
      attempt_id:        attemptId,
      title,
      images_json:       Array.isArray(body.images_json) ? body.images_json : [],
      videos_json:       Array.isArray(body.videos_json) ? body.videos_json : [],
      price_cents:       priceCents,
      currency:          "usd",
      tier:              typeof body.tier === "string" ? body.tier.trim() || null : null,
      color:             typeof body.color === "string" ? body.color.trim() || null : null,
      dimensions:        typeof body.dimensions === "string" ? body.dimensions.trim() || null : null,
      notes:             typeof body.notes === "string" ? body.notes.trim() || null : null,
      source_product_id: typeof body.source_product_id === "string" ? body.source_product_id : null,
      status:            "draft",
      sort_order:        sortOrder,
    })
    .select()
    .single();

  if (insertErr || !option) {
    console.error("[options] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to add option." }, { status: 500 });
  }

  return NextResponse.json({ option });
}
