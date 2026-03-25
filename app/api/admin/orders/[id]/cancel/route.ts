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
  const body = (await req.json().catch(() => ({}))) as {
    sendEmail?: boolean;
    reason?: string;
    restoreItems?: boolean;
  };
  const { sendEmail, reason, restoreItems } = body;

  const REASON_LABELS: Record<string, string> = {
    customer_changed_mind: "Customer changed their mind",
    payment_not_completed: "Customer did not complete payment on time",
    admin_mistake: "Order created by mistake by admin",
    product_unavailable: "Product no longer available",
  };

  // Fetch current order (for notes) and items (for restore)
  const [{ data: currentOrder }, { data: orderItems }] = await Promise.all([
    supabaseAdmin.from("orders").select("notes").eq("id", id).single(),
    restoreItems
      ? supabaseAdmin.from("order_items").select("product_id").eq("order_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  // Append cancellation reason to notes
  const reasonLabel = reason ? REASON_LABELS[reason] ?? reason : null;
  const existingNotes = currentOrder?.notes ?? "";
  const reasonNote = reasonLabel ? `[Cancellation reason: ${reasonLabel}]` : null;
  const updatedNotes = [existingNotes, reasonNote].filter(Boolean).join("\n").trim() || null;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .update({
      order_status: "order_cancelled",
      ...(updatedNotes !== existingNotes ? { notes: updatedNotes } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Cancel failed" }, { status: 500 });
  }

  // Restore linked products to available
  if (restoreItems) {
    const productIds = (orderItems ?? [])
      .map((i: { product_id: string | null }) => i.product_id)
      .filter(Boolean) as string[];
    if (productIds.length > 0) {
      await supabaseAdmin
        .from("products")
        .update({ status: "available" })
        .in("id", productIds);
    }
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
