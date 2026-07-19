import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { getStoreCreditDisplayConditions } from "@/lib/store-credit";
import { sendStoreCreditIssuedEmail } from "@/lib/discount-emails";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: storeCredit, error } = await supabaseAdmin
    .from("store_credits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !storeCredit) {
    return NextResponse.json({ error: "Store credit not found." }, { status: 404 });
  }

  let sourceOrderNumber: string | null = null;
  let customerName: string | null = null;
  if (storeCredit.source_order_id) {
    const { data: srcOrder } = await supabaseAdmin
      .from("orders")
      .select("order_number, customer_name")
      .eq("id", storeCredit.source_order_id)
      .maybeSingle();
    sourceOrderNumber = srcOrder?.order_number ?? null;
    customerName = srcOrder?.customer_name ?? null;
  }
  if (!customerName && storeCredit.customer_id) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("customer_name")
      .eq("id", storeCredit.customer_id)
      .maybeSingle();
    customerName = customer?.customer_name ?? null;
  }

  try {
    await sendStoreCreditIssuedEmail({
      storeCredit,
      customerName,
      sourceOrderNumber,
      conditions: getStoreCreditDisplayConditions(storeCredit),
      isResend: true,
    });
  } catch (err) {
    console.error("[store-credits] Resend email failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
