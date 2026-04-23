import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendReferralInviteEmail } from "@/lib/discount-emails";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

// POST /api/admin/customers/[id]/send-referral-invite
// Manually sends (or re-sends) the referral invite email to a customer.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, customer_name, customer_email, referral_code")
    .eq("id", id)
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (!customer.referral_code) {
    return NextResponse.json(
      { error: "This customer does not have a referral code yet. It is generated automatically on their first delivered order." },
      { status: 400 }
    );
  }

  await sendReferralInviteEmail({
    customerName: customer.customer_name ?? "Valued Customer",
    customerEmail: customer.customer_email,
    referralCode: customer.referral_code,
    orderNumber: "manual",
  });

  return NextResponse.json({ ok: true });
}
