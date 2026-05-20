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

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  let query = supabaseAdmin
    .from("customer_restrictions")
    .select(`
      *,
      customers ( id, customer_name, customer_email )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,normalized_email.ilike.%${search}%,phone.ilike.%${search}%,address_line1.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restrictions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const normalized_email  = body.email        ? normalizeEmailRestriction(body.email) : null;
  const normalized_phone  = body.phone        ? normalizePhone(body.phone)            : null;
  const normalized_address =
    body.address_line1 && body.city && body.postal_code && body.country
      ? buildNormalizedAddress(body.address_line1, body.city, body.postal_code, body.country)
      : null;

  const { data, error } = await supabaseAdmin
    .from("customer_restrictions")
    .insert({
      customer_id:       body.customer_id       ?? null,
      name:              body.name              ? normalizeName(body.name) : null,
      email:             body.email             ?? null,
      normalized_email,
      phone:             body.phone             ?? null,
      normalized_phone,
      address_line1:     body.address_line1     ? normalizeAddressLine(body.address_line1) : null,
      address_line2:     body.address_line2     ? normalizeGeo(body.address_line2)         : null,
      city:              body.city              ? normalizeGeo(body.city)                  : null,
      state:             body.state             ? normalizeGeo(body.state)                 : null,
      postal_code:       body.postal_code       ? normalizePostal(body.postal_code)        : null,
      country:           body.country           ? normalizeGeo(body.country)               : null,
      normalized_address,
      reason:            body.reason            ?? null,
      internal_notes:    body.internal_notes    ?? null,
      status:            body.status            ?? "active",
      severity:          body.severity          ?? "blocked",
      updated_at:        new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restriction: data }, { status: 201 });
}
