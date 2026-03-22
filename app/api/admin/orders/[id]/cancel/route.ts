import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderStatusEmail, fetchEmailItems } from "@/lib/orders";

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
    const items = await fetchEmailItems(id);
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
