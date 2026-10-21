import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

// GET /api/admin/claims — the /claims-admin queue (§28).
// Filters: ?responsibility=..., ?claimType=..., ?status=..., ?q=<search>
// Search matches claim number, order number, customer name/email, tracking
// number, product SKU, or certificate number.
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const responsibility = searchParams.get("responsibility");
  const claimType = searchParams.get("claimType");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  let query = supabaseAdmin
    .from("claims")
    .select(`
      id, claim_number, claim_type, claim_subtype, status, responsibility, priority,
      assigned_admin, next_action, next_action_due_at, customer_email, opened_at, resolved_at, closed_at,
      orders!inner(order_number, customer_name)
    `)
    .order("opened_at", { ascending: false })
    .limit(200);

  if (responsibility) query = query.eq("responsibility", responsibility);
  if (claimType) query = query.eq("claim_type", claimType);
  if (status) query = query.eq("status", status);

  if (q) {
    // Broad OR search across claim_number/customer_email + a couple of
    // joined lookups (order number, tracking number, sku, certificate).
    const [{ data: byOrderNumber }, { data: byTracking }, { data: bySku }, { data: byCert }] = await Promise.all([
      supabaseAdmin.from("orders").select("id").ilike("order_number", `%${q}%`),
      supabaseAdmin.from("return_shipments").select("return_id, returns!inner(claim_id)").ilike("tracking_number", `%${q}%`),
      supabaseAdmin.from("claim_items").select("claim_id").ilike("sku", `%${q}%`),
      supabaseAdmin.from("claim_items").select("claim_id").ilike("certificate_number", `%${q}%`),
    ]);
    const orderIds = (byOrderNumber ?? []).map((o) => o.id);
    const claimIdsFromJoins = [
      ...(byTracking ?? []).map((r) => (r.returns as unknown as { claim_id: string }).claim_id),
      ...(bySku ?? []).map((r) => r.claim_id),
      ...(byCert ?? []).map((r) => r.claim_id),
    ];
    const orClauses = [
      `claim_number.ilike.%${q}%`,
      `customer_email.ilike.%${q}%`,
      ...(orderIds.length ? [`order_id.in.(${orderIds.join(",")})`] : []),
      ...(claimIdsFromJoins.length ? [`id.in.(${[...new Set(claimIdsFromJoins)].join(",")})`] : []),
    ];
    query = query.or(orClauses.join(","));
  }

  const { data: claims, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claims: claims ?? [] });
}
