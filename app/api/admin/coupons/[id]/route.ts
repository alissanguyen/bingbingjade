import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/admin/coupons/[id] — update a campaign (toggle active, edit fields)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: Partial<{
    active: boolean;
    name: string;
    ends_at: string | null;
    starts_at: string | null;
    notes: string | null;
    max_total_redemptions: number | null;
    minimum_order_amount: number | null;
    new_customers_only: boolean;
    max_redemptions_per_customer: number;
    discount_value: number | null;
    discount_type: "fixed" | "percent" | "tiered";
  }>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Only allow updating safe fields (not code — that's immutable)
  const allowed = [
    "active", "name", "ends_at", "starts_at", "notes",
    "max_total_redemptions", "minimum_order_amount", "new_customers_only",
    "max_redemptions_per_customer", "discount_value", "discount_type",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = (body as Record<string, unknown>)[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coupon_campaigns")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  return NextResponse.json(data);
}
