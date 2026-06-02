import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("inventory_batches")
    .select("id, name, batch_code, vendor, status, purchase_date, received_date, total_batch_cost_usd, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const insert: Record<string, unknown> = {
    name,
    batch_code:            (body.batch_code as string | undefined)?.trim() || null,
    vendor:                (body.vendor as string | undefined)?.trim() || null,
    purchase_date:         body.purchase_date || null,
    received_date:         body.received_date || null,
    status:                body.status || "draft",
    goods_cost_usd:        Number(body.goods_cost_usd ?? 0),
    freight_cost_usd:      Number(body.freight_cost_usd ?? 0),
    insurance_cost_usd:    Number(body.insurance_cost_usd ?? 0),
    duties_cost_usd:       Number(body.duties_cost_usd ?? 0),
    certification_cost_usd: Number(body.certification_cost_usd ?? 0),
    misc_cost_usd:         Number(body.misc_cost_usd ?? 0),
    notes:                 (body.notes as string | undefined)?.trim() || null,
    item_count:            body.item_count != null ? (Number(body.item_count) || null) : null,
  };

  const { data, error } = await supabaseAdmin
    .from("inventory_batches")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data }, { status: 201 });
}
