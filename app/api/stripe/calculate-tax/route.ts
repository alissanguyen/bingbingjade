import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, shippingAddress, shippingCents, insuranceCents } = body as {
      items: { price: number }[];
      shippingAddress: { line1: string; city: string; state: string; postal_code: string; country: string };
      // WA taxes delivery charges and seller-added fees like shipping insurance as
      // part of the taxable "selling price" (RCW 82.08.010 / WAC 458-20-110) — both
      // must be included here, not just merchandise, or this preview (and the
      // amount actually charged) under-collects tax. This is a preview only; the
      // checkout route recomputes the authoritative amount server-side and never
      // trusts a client-supplied tax figure.
      shippingCents?: number;
      insuranceCents?: number;
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
    if (shippingCents && shippingCents > 0) {
      lineItems.push({ amount: Math.round(shippingCents), reference: "shipping", tax_code: "txcd_99999999" });
    }
    if (insuranceCents && insuranceCents > 0) {
      lineItems.push({ amount: Math.round(insuranceCents), reference: "insurance", tax_code: "txcd_99999999" });
    }

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
