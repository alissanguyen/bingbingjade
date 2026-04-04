import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    carrier?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    shipping_method?: string | null;
    shipping_cost?: number | null;
    insurance_selected?: boolean;
    destination_country?: string | null;
    estimated_ship_date?: string | null;
    estimated_delivery_start?: string | null;
    estimated_delivery_end?: string | null;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("carrier" in body)                   updates.carrier = body.carrier ?? null;
  if ("tracking_number" in body)           updates.tracking_number = body.tracking_number ?? null;
  if ("tracking_url" in body)              updates.tracking_url = body.tracking_url ?? null;
  if ("shipping_method" in body)           updates.shipping_method = body.shipping_method ?? null;
  if ("shipping_cost" in body)             updates.shipping_cost = body.shipping_cost ?? null;
  if ("insurance_selected" in body)        updates.insurance_selected = body.insurance_selected ?? false;
  if ("destination_country" in body)       updates.destination_country = body.destination_country ?? null;
  if ("estimated_ship_date" in body)       updates.estimated_ship_date = body.estimated_ship_date ?? null;
  if ("estimated_delivery_start" in body)  updates.estimated_delivery_start = body.estimated_delivery_start ?? null;
  if ("estimated_delivery_end" in body)    updates.estimated_delivery_end = body.estimated_delivery_end ?? null;

  const { data, error } = await supabaseAdmin
    .from("shipments")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data)
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });

  return NextResponse.json({ shipment: data });
}
