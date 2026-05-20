import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import {
  normalizeEmailRestriction,
  normalizePhone,
  normalizeName,
  normalizeAddressLine,
  normalizePostal,
  normalizeGeo,
  buildNormalizedAddress,
} from "@/lib/customer-restrictions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: restriction }, { data: attempts }] = await Promise.all([
    supabaseAdmin
      .from("customer_restrictions")
      .select("*, customers ( id, customer_name, customer_email )")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("blocked_checkout_attempts")
      .select("*")
      .eq("restriction_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!restriction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ restriction, attempts: attempts ?? [] });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    customer_id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    reason?: string | null;
    internal_notes?: string | null;
    status?: string;
    severity?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("customer_id"    in body) updates.customer_id    = body.customer_id    ?? null;
  if ("reason"         in body) updates.reason         = body.reason         ?? null;
  if ("internal_notes" in body) updates.internal_notes = body.internal_notes ?? null;
  if ("status"         in body) updates.status         = body.status;
  if ("severity"       in body) updates.severity       = body.severity;

  if ("name" in body) {
    updates.name = body.name ? normalizeName(body.name) : null;
  }
  if ("email" in body) {
    updates.email            = body.email ?? null;
    updates.normalized_email = body.email ? normalizeEmailRestriction(body.email) : null;
  }
  if ("phone" in body) {
    updates.phone            = body.phone ?? null;
    updates.normalized_phone = body.phone ? normalizePhone(body.phone) : null;
  }
  if ("address_line1" in body) {
    updates.address_line1 = body.address_line1 ? normalizeAddressLine(body.address_line1) : null;
  }
  if ("address_line2" in body) updates.address_line2 = body.address_line2 ? normalizeGeo(body.address_line2) : null;
  if ("city"          in body) updates.city          = body.city   ? normalizeGeo(body.city)            : null;
  if ("state"         in body) updates.state         = body.state  ? normalizeGeo(body.state)           : null;
  if ("postal_code"   in body) updates.postal_code   = body.postal_code ? normalizePostal(body.postal_code) : null;
  if ("country"       in body) updates.country       = body.country ? normalizeGeo(body.country)        : null;

  // Recompute full normalized address whenever any component may have changed
  if (
    "address_line1" in body || "city" in body ||
    "postal_code" in body   || "country" in body
  ) {
    const { data: existing } = await supabaseAdmin
      .from("customer_restrictions")
      .select("address_line1, city, postal_code, country")
      .eq("id", id)
      .single();

    const l1 = (updates.address_line1 as string | null) ?? existing?.address_line1 ?? null;
    const ct = (updates.city          as string | null) ?? existing?.city           ?? null;
    const pc = (updates.postal_code   as string | null) ?? existing?.postal_code    ?? null;
    const co = (updates.country       as string | null) ?? existing?.country        ?? null;

    updates.normalized_address = l1 && ct && pc && co
      ? buildNormalizedAddress(l1, ct, pc, co)
      : null;
  }

  const { data, error } = await supabaseAdmin
    .from("customer_restrictions")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restriction: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("customer_restrictions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
