import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

// POST /api/admin/reservations/[id]/deposit-checkout
// Creates a Stripe checkout session for the reservation deposit.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { customerEmail?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const { data: reservation, error: fetchError } = await supabaseAdmin
    .from("product_reservations")
    .select("id, product_id, customer_name, customer_email, deposit_amount_usd, expires_at, cancelled_at")
    .eq("id", id)
    .single();

  if (fetchError || !reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.cancelled_at) {
    return NextResponse.json({ error: "Reservation is cancelled." }, { status: 400 });
  }

  if (new Date(reservation.expires_at) <= new Date()) {
    return NextResponse.json({ error: "Reservation has expired." }, { status: 400 });
  }

  const depositAmount = Number(reservation.deposit_amount_usd ?? 0);
  if (depositAmount <= 0) {
    return NextResponse.json({ error: "No deposit amount set on this reservation." }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("name, public_id, slug")
    .eq("id", reservation.product_id)
    .single();

  const customerEmail = body.customerEmail || reservation.customer_email || undefined;
  const productName = product?.name ?? "Reservation";
  const depositAmountCents = Math.round(depositAmount * 100);

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "usd",
    payment_method_types: ["card"],
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Deposit — ${productName}`,
            description: `Reservation deposit. Piece held until ${new Date(reservation.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
          },
          unit_amount: depositAmountCents,
          tax_behavior: "exclusive",
        },
        quantity: 1,
      },
    ],
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: product?.slug
      ? `${SITE_URL}/products/${product.slug}-${product.public_id}`
      : `${SITE_URL}/products`,
    metadata: {
      is_reservation_deposit: "true",
      reservation_id: reservation.id,
      product_id: reservation.product_id,
      customer_name: reservation.customer_name ?? "",
    },
  });

  // Store the session ID on the reservation for tracking
  await supabaseAdmin
    .from("product_reservations")
    .update({ deposit_stripe_session_id: stripeSession.id })
    .eq("id", reservation.id);

  return NextResponse.json({ url: stripeSession.url });
}
