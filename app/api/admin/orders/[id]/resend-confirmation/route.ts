import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderConfirmationEmail } from "@/lib/orders";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order.order_number || !order.customer_name || !order.customer_email) {
    return NextResponse.json(
      { error: "Order is missing number, customer name, or email." },
      { status: 400 }
    );
  }

  await sendOrderConfirmationEmail({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    amountTotalCents: order.amount_total ?? 0,
    items: (order.order_items ?? []).map((i: { product_name: string; option_label: string | null; price_usd: number | null; quantity: number }) => ({
      name: i.product_name,
      option: i.option_label,
      price: i.price_usd ?? 0,
      quantity: i.quantity ?? 1,
    })),
    estimatedDelivery: order.estimated_delivery_date ?? null,
  });

  return NextResponse.json({ ok: true });
}
