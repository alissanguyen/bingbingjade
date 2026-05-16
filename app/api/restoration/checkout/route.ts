import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { calculateStripeFee } from "@/lib/shipping";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  let body: {
    clientType?: "new" | "bingbing_client";
    verified?: boolean;
    verifiedOrderNumber?: string;
    customerEmail?: string;
    customerName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { clientType, verified, verifiedOrderNumber, customerEmail, customerName } = body;

  if (!customerEmail?.trim() || !customerName?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (clientType !== "new" && clientType !== "bingbing_client") {
    return NextResponse.json({ error: "Invalid client type." }, { status: 400 });
  }

  let priceCents: number;
  if (clientType === "bingbing_client") {
    if (!verified) {
      return NextResponse.json({ error: "Client verification is required for the discounted rate." }, { status: 403 });
    }
    // Re-confirm the order exists server-side to prevent client-side tampering
    if (verifiedOrderNumber) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("order_number", verifiedOrderNumber.trim().toUpperCase())
        .maybeSingle();
      if (!order) {
        return NextResponse.json({ error: "Verification could not be confirmed. Please verify again." }, { status: 403 });
      }
    }
    priceCents = 5000; // $50
  } else {
    priceCents = 10000; // $100
  }

  const serviceLabel =
    clientType === "bingbing_client"
      ? "Jade Bangle Polishing — BingBing Jade Client Rate"
      : "Jade Bangle Polishing — Standard";
  const timeline = clientType === "bingbing_client" ? "2–4 weeks" : "4–6 weeks";
  const txFeeCents = calculateStripeFee(priceCents, "domestic");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail.trim(),
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "AU", "NZ", "AT", "BE", "DK", "FI", "FR", "DE", "IT", "NL", "NO", "ES", "SE", "CH"],
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: serviceLabel,
            description: `Estimated timeline: ${timeline}. Please ship your bangle to us after checkout confirmation; we will return it carefully packaged once the service is complete.`,
          },
          unit_amount: priceCents,
          tax_behavior: "exclusive",
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Processing Fee" },
          unit_amount: txFeeCents,
          tax_behavior: "exclusive",
        },
        quantity: 1,
      },
    ],
    metadata: {
      service_type: "polishing",
      client_type: clientType,
      verified_client: String(!!verified),
      quote_required: "false",
      customer_name: customerName.trim(),
      ...(verifiedOrderNumber ? { original_order_number: verifiedOrderNumber.toUpperCase() } : {}),
    },
    success_url: `${SITE_URL}/restoration?checkout=success`,
    cancel_url: `${SITE_URL}/restoration`,
  });

  return NextResponse.json({ url: session.url });
}
