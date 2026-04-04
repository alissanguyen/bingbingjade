import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/discount";
import { classifyFromInputs, CREDIT_VALIDITY_DAYS } from "@/lib/sourcing-classification";
import type { ClassificationInputs } from "@/lib/sourcing-classification";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

// ── In-memory rate limiter (IP-based) ─────────────────────────────────────────
// Note: resets on cold starts in serverless. For high-traffic use an external store.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // 3 submissions per window

const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Input validation ──────────────────────────────────────────────────────────
const VALID_CATEGORIES = ["bracelet", "bangle", "ring", "pendant", "necklace", "set", "other"] as const;
const VALID_TIMELINES = ["asap", "within_1_month", "1-2_months", "within_3_months"] as const;

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isEmailish(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Honeypot check ────────────────────────────────────────────────────────
  // Bots that fill hidden fields are silently rejected with a fake-success response
  if (body.website || body.url || body.company) {
    return NextResponse.json({ url: `${SITE_URL}/custom-sourcing/success?session_id=bot` });
  }

  // ── Required field validation ─────────────────────────────────────────────
  const name = isString(body.name) ? body.name.trim() : "";
  const emailRaw = isString(body.email) ? body.email.trim() : "";
  const category = isString(body.category) ? body.category.trim() : "";
  const budgetMinRaw = body.budget_min;
  const budgetMaxRaw = body.budget_max;

  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json({ error: "Please provide your name (2–100 characters)." }, { status: 400 });
  }
  if (!emailRaw || !isEmailish(emailRaw)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: "Please select a valid product category." }, { status: 400 });
  }

  const budgetMin = typeof budgetMinRaw === "number" ? Math.floor(budgetMinRaw) : parseInt(String(budgetMinRaw ?? ""), 10);
  if (isNaN(budgetMin) || budgetMin < 50 || budgetMin > 1_000_000) {
    return NextResponse.json({ error: "Please enter a valid minimum budget (at least $50)." }, { status: 400 });
  }

  let budgetMax: number | null = null;
  if (budgetMaxRaw !== undefined && budgetMaxRaw !== null && budgetMaxRaw !== "") {
    budgetMax = typeof budgetMaxRaw === "number" ? Math.floor(budgetMaxRaw) : parseInt(String(budgetMaxRaw), 10);
    if (isNaN(budgetMax) || budgetMax < budgetMin) {
      return NextResponse.json({ error: "Maximum budget must be greater than minimum budget." }, { status: 400 });
    }
  }

  const timeline = isString(body.timeline) ? body.timeline.trim() : "flexible";
  if (!VALID_TIMELINES.includes(timeline as typeof VALID_TIMELINES[number])) {
    return NextResponse.json({ error: "Please select a valid timeline." }, { status: 400 });
  }

  // ── Classification (server-side — never trust the client) ─────────────────
  const classInputs: ClassificationInputs = {
    closeReferenceMatch:    body.close_reference_match === true,
    exactColorMatters:      body.exact_color_matters === true,
    patternVeiningMatters:  body.pattern_veining_matters === true,
    translucencyMatters:    body.translucency_matters === true,
    exactDimensionsMatters: body.exact_dimensions_matters === true,
    mustHaves:              isString(body.must_haves) ? body.must_haves.slice(0, 2000) : undefined,
  };

  const { score, requestType, depositCents } = classifyFromInputs(classInputs);

  // ── Build preferences snapshot ────────────────────────────────────────────
  const preferences = {
    preferred_color:          isString(body.preferred_color) ? body.preferred_color.slice(0, 500) : null,
    size_description:         isString(body.size_description) ? body.size_description.slice(0, 500) : null,
    must_haves:               isString(body.must_haves) ? body.must_haves.slice(0, 2000) : null,
    must_avoid:               isString(body.must_avoid) ? body.must_avoid.slice(0, 2000) : null,
    timeline,
    notes:                    isString(body.notes) ? body.notes.slice(0, 3000) : null,
    close_reference_match:    classInputs.closeReferenceMatch,
    reference_notes:          isString(body.reference_notes) ? body.reference_notes.slice(0, 1000) : null,
    exact_color_matters:      classInputs.exactColorMatters,
    color_detail:             isString(body.color_detail) ? body.color_detail.slice(0, 500) : null,
    pattern_veining_matters:  classInputs.patternVeiningMatters,
    pattern_description:      isString(body.pattern_description) ? body.pattern_description.slice(0, 500) : null,
    translucency_matters:     classInputs.translucencyMatters,
    translucency_preference:  isString(body.translucency_preference) ? body.translucency_preference.slice(0, 100) : null,
    exact_dimensions_matters: classInputs.exactDimensionsMatters,
    exact_dimensions:         isString(body.exact_dimensions) ? body.exact_dimensions.slice(0, 500) : null,
  };

  // ── Reference images ──────────────────────────────────────────────────────
  type RefImage = { type: "url" | "storage"; value: string; originalName?: string };
  const refImages: RefImage[] = [];

  if (Array.isArray(body.reference_images)) {
    for (const img of body.reference_images.slice(0, 10)) {
      if (img && typeof img === "object" && "type" in img && "value" in img) {
        const type = (img as RefImage).type;
        const value = (img as RefImage).value;
        if ((type === "url" || type === "storage") && typeof value === "string" && value.length < 2000) {
          refImages.push({ type, value, originalName: typeof (img as RefImage).originalName === "string" ? (img as RefImage).originalName : undefined });
        }
      }
    }
  }

  const email = normalizeEmail(emailRaw);

  // ── Deduplication: same email + category submitted in the last 5 min ──────
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, stripe_checkout_session_id")
    .eq("customer_email", email)
    .eq("category", category)
    .eq("payment_status", "awaiting_payment")
    .gte("created_at", fiveMinAgo)
    .maybeSingle();

  if (recent) {
    // Return the existing checkout session rather than creating a duplicate
    if (recent.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(recent.stripe_checkout_session_id);
      if (existingSession.url && existingSession.status === "open") {
        return NextResponse.json({ url: existingSession.url });
      }
    }
    // Session missing or expired — fall through and create a fresh one
  }

  // ── Insert sourcing_request ───────────────────────────────────────────────
  const { data: sourcing, error: insertErr } = await supabaseAdmin
    .from("sourcing_requests")
    .insert({
      customer_email:       email,
      customer_name:        name,
      category,
      budget_min:           budgetMin,
      budget_max:           budgetMax,
      request_type:         requestType,
      strictness_score:     score,
      preferences_json:     preferences,
      reference_images_json: refImages,
      deposit_amount_cents: depositCents,
      currency:             "usd",
      payment_status:       "awaiting_payment",
      sourcing_status:      "queued",
    })
    .select("id")
    .single();

  if (insertErr || !sourcing) {
    console.error("[sourcing/checkout] Insert failed:", insertErr);
    return NextResponse.json({ error: "Could not create sourcing request. Please try again." }, { status: 500 });
  }

  // ── Create Stripe Checkout Session ────────────────────────────────────────
  const productLabel =
    requestType === "premium"
      ? "Custom Sourcing Deposit — Premium"
      : "Custom Sourcing Deposit — Standard";

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

  let stripeSession: { id: string; url: string | null };
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productLabel,
              description: `${categoryLabel} · ${requestType === "premium" ? "Premium" : "Standard"} sourcing request. Budget: $${budgetMin}${budgetMax ? `–$${budgetMax}` : "+"}. Deposit is applied as credit toward your final order.`,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${SITE_URL}/custom-sourcing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:   `${SITE_URL}/custom-sourcing?cancelled=1`,
      metadata: {
        is_sourcing_deposit:    "true",
        sourcing_request_id:    sourcing.id,
        request_type:           requestType,
        customer_email:         email,
        deposit_amount_cents:   String(depositCents),
      },
    });
  } catch (err) {
    console.error("[sourcing/checkout] Stripe session creation failed:", err);
    // Clean up the orphaned row
    await supabaseAdmin.from("sourcing_requests").delete().eq("id", sourcing.id);
    return NextResponse.json({ error: "Payment setup failed. Please try again." }, { status: 500 });
  }

  // ── Store session ID back on the request ──────────────────────────────────
  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      stripe_checkout_session_id: stripeSession.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourcing.id);

  return NextResponse.json({ url: stripeSession.url });
}
