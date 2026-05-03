import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/admin/subscribers?status=all|active|used|expired|unsubscribed
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("email_subscribers")
    .select("id, email, subscribed_at, welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at, source, used_fingerprint, unsubscribed_at")
    .order("subscribed_at", { ascending: false });

  if (status === "unsubscribed") {
    query = query.not("unsubscribed_at", "is", null);
  } else {
    // All other filters only operate on active (not unsubscribed) rows
    query = query.is("unsubscribed_at", null);

    if (status === "used") {
      query = query.not("welcome_discount_redeemed_at", "is", null);
    } else if (status === "active") {
      query = query
        .not("welcome_coupon_code", "is", null)
        .is("welcome_discount_redeemed_at", null)
        .gt("welcome_coupon_expires_at", now);
    } else if (status === "expired") {
      query = query
        .not("welcome_coupon_code", "is", null)
        .is("welcome_discount_redeemed_at", null)
        .lt("welcome_coupon_expires_at", now);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
