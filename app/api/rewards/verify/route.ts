import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token || token.length !== 64) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the token
  const { data: tokenRow } = await supabaseAdmin
    .from("rewards_tokens")
    .select("email, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "This link is invalid or has already been used." }, { status: 401 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "This link has expired. Please request a new one." }, { status: 401 });
  }

  const email = tokenRow.email;

  // Fetch customer
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, customer_name, referral_code, store_credit_balance, first_delivered_order_at")
    .eq("customer_email", email)
    .maybeSingle();

  if (!customer?.referral_code) {
    return NextResponse.json({ error: "No rewards found for this email." }, { status: 404 });
  }

  // Fetch credit ledger stats
  const { data: ledger } = await supabaseAdmin
    .from("store_credit_ledger")
    .select("amount")
    .eq("customer_id", customer.id);

  const totalEarned = (ledger ?? [])
    .filter((r) => r.amount > 0)
    .reduce((s, r) => s + Number(r.amount), 0);

  const totalUsed = (ledger ?? [])
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);

  // Referral stats
  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("status")
    .eq("referrer_customer_id", customer.id);

  const successfulReferrals = (referrals ?? []).filter((r) => r.status === "rewarded").length;
  const pendingReferrals = (referrals ?? []).filter((r) => r.status === "qualified").length;

  return NextResponse.json({
    customerName: customer.customer_name,
    referralCode: customer.referral_code,
    availableBalance: Number(customer.store_credit_balance ?? 0),
    totalEarned,
    totalUsed,
    successfulReferrals,
    pendingReferrals,
  });
}
