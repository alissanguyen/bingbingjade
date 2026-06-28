import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("status, checkout_active, checkout_expires_at, checkout_url")
    .eq("checkout_token", token)
    .maybeSingle();

  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

  if (!item) {
    return NextResponse.redirect(`${SITE_URL}/livestream-checkout/invalid`);
  }

  if (!item.checkout_active || item.status !== "checkout_sent") {
    return NextResponse.redirect(`${SITE_URL}/livestream-checkout/expired`);
  }

  if (item.checkout_expires_at && new Date(item.checkout_expires_at) < new Date()) {
    return NextResponse.redirect(`${SITE_URL}/livestream-checkout/expired`);
  }

  if (!item.checkout_url) {
    return NextResponse.redirect(`${SITE_URL}/livestream-checkout/invalid`);
  }

  return NextResponse.redirect(item.checkout_url);
}
