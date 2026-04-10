import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, shippingAddress } = body as {
      items: { price: number }[];
      shippingAddress: { line1: string; city: string; state: string; postal_code: string; country: string };
    };

    // Only WA requires tax
    if (shippingAddress.country !== "US" || shippingAddress.state?.toUpperCase() !== "WA") {
      return NextResponse.json({ taxAmountCents: 0, calculationId: null });
    }

    const lineItems = items.map((item, i) => ({
      amount: Math.round(item.price * 100),
      reference: `L${i + 1}`,
      tax_code: "txcd_99999999",
    }));

    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      line_items: lineItems,
      customer_details: {
        address: {
          line1: shippingAddress.line1,
          city: shippingAddress.city,
          state: "WA",
          postal_code: shippingAddress.postal_code,
          country: "US",
        },
        address_source: "shipping",
      },
    });

    return NextResponse.json({
      taxAmountCents: calculation.tax_amount_exclusive,
      calculationId: calculation.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[calculate-tax]", message);
    return NextResponse.json({ taxAmountCents: 0, calculationId: null });
  }
}
