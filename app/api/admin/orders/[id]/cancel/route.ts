import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderStatusEmail } from "@/lib/orders";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { sendEmail } = (await req.json().catch(() => ({}))) as { sendEmail?: boolean };

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .update({ order_status: "order_cancelled" })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Cancel failed" }, { status: 500 });
  }

  if (sendEmail && order.customer_name && order.customer_email && order.order_number) {
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("product_name, option_label, price_usd, quantity")
      .eq("order_id", id);
    const items = (orderItems ?? []).map((i) => ({
      name: i.product_name,
      option: i.option_label,
      price: i.price_usd ?? 0,
      quantity: i.quantity ?? 1,
    }));
    await sendOrderStatusEmail({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      newStatus: "order_cancelled",
      items,
    });
  }

  return NextResponse.json({ order });
}
