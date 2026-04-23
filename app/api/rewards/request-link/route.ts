import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/discount";
import { sendRewardsMagicLinkEmail } from "@/lib/rewards-emails";

// Generic response — never reveal whether an email exists
const GENERIC_OK = { message: "If this email is associated with a BingBing Jade order, you'll receive a secure link shortly." };

// ── In-memory rate limit (IP-based, resets on cold start) ─────────────────────
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 3;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    // Return generic message — don't reveal rate limit to avoid enumeration
    return NextResponse.json(GENERIC_OK);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);

  // Check if this customer exists and has a referral code (i.e., had a delivered order)
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, referral_code")
    .eq("customer_email", email)
    .maybeSingle();

  // Always return generic response — no leak of whether email exists
  if (!customer?.referral_code) {
    return NextResponse.json(GENERIC_OK);
  }

  // If a valid unexpired token already exists for this email, skip creating a new one
  // (prevents email flooding from the same address within the window)
  const now = new Date();
  const { data: existing } = await supabaseAdmin
    .from("rewards_tokens")
    .select("id")
    .eq("email", email)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (!existing) {
    // Generate a secure random token (32 bytes = 256 bits)
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Prune expired tokens for this email first
    await supabaseAdmin
      .from("rewards_tokens")
      .delete()
      .eq("email", email)
      .lt("expires_at", now.toISOString());

    await supabaseAdmin
      .from("rewards_tokens")
      .insert({ email, token_hash: tokenHash, expires_at: expiresAt });

    // Fire-and-forget email
    sendRewardsMagicLinkEmail({ toEmail: email, token }).catch(() => {});
  }

  return NextResponse.json(GENERIC_OK);
}
