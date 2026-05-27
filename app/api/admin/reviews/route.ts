import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/admin/reviews?status=pending|approved|all
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "all";

  let query = supabaseAdmin
    .from("reviews")
    .select(`
      id, order_number, customer_name, rating, description,
      date_purchased, date_rated, is_approved, created_at,
      review_images ( id, image_path, sort_order )
    `)
    .order("created_at", { ascending: false });

  if (status === "pending") query = query.eq("is_approved", false);
  if (status === "approved") query = query.eq("is_approved", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
