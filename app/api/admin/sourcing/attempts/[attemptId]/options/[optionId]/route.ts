import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ attemptId: string; optionId: string }> };

// PUT — update an option
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { attemptId, optionId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "draft") {
    return NextResponse.json({ error: "Can only edit options in a draft attempt." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.price_cents === "number") updates.price_cents = Math.floor(body.price_cents);
  if (typeof body.tier === "string") updates.tier = body.tier.trim() || null;
  if (typeof body.color === "string") updates.color = body.color.trim() || null;
  if (typeof body.dimensions === "string") updates.dimensions = body.dimensions.trim() || null;
  if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
  if (Array.isArray(body.images_json)) updates.images_json = body.images_json;
  if (typeof body.sort_order === "number") updates.sort_order = Math.floor(body.sort_order);

  const { data: option, error: updateErr } = await supabaseAdmin
    .from("sourcing_attempt_options")
    .update(updates)
    .eq("id", optionId)
    .eq("attempt_id", attemptId)
    .select()
    .single();

  if (updateErr || !option) {
    return NextResponse.json({ error: "Failed to update option." }, { status: 500 });
  }

  return NextResponse.json({ option });
}

// DELETE — remove an option
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { attemptId, optionId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.status !== "draft") {
    return NextResponse.json({ error: "Can only delete options from a draft attempt." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sourcing_attempt_options")
    .delete()
    .eq("id", optionId)
    .eq("attempt_id", attemptId);

  if (error) return NextResponse.json({ error: "Failed to delete option." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
