import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export async function POST(req: NextRequest) {
  let body: { orderNumber?: string; phone?: string; postalCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { orderNumber, phone, postalCode } = body;
  if (!orderNumber?.trim() || !phone?.trim() || !postalCode?.trim()) {
    return NextResponse.json({ error: "Order number, phone number, and ZIP code are all required." }, { status: 400 });
  }

  const inputPhone = normalizePhone(phone);
  if (inputPhone.length < 7) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_id, customer_phone_snapshot, customer_email, shipping_address_id")
    .eq("order_number", orderNumber.trim().toUpperCase())
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ verified: false, error: "Order not found. Please double-check your order number." });
  }

  // Check phone — first try customer_phone_snapshot on the order, then the customers table
  const snapshotPhone = normalizePhone((order.customer_phone_snapshot as string) ?? "");
  let phoneMatch = snapshotPhone.length >= 7 && snapshotPhone.slice(-7) === inputPhone.slice(-7);

  if (!phoneMatch && order.customer_id) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("customer_phone")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (customer?.customer_phone) {
      const custPhone = normalizePhone(customer.customer_phone as string);
      phoneMatch = custPhone.length >= 7 && custPhone.slice(-7) === inputPhone.slice(-7);
    }
  }

  if (!phoneMatch) {
    return NextResponse.json({ verified: false, error: "Phone number does not match our records for that order." });
  }

  // Check postal code against the shipping address on the order
  if (order.shipping_address_id) {
    const { data: addr } = await supabaseAdmin
      .from("customer_addresses")
      .select("postal_code")
      .eq("id", order.shipping_address_id)
      .maybeSingle();

    if (addr?.postal_code) {
      const stored = (addr.postal_code as string).replace(/\s/g, "").toLowerCase();
      const input = postalCode.trim().replace(/\s/g, "").toLowerCase();
      if (stored !== input) {
        return NextResponse.json({ verified: false, error: "ZIP code does not match the shipping address on that order." });
      }
    }
  }

  return NextResponse.json({
    verified: true,
    customerEmail: order.customer_email as string,
  });
}
