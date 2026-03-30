/**
 * POST /api/admin/create-customer
 *
 * Manually create or update a customer record (for WhatsApp/cash/custom orders
 * where the customer isn't going through Stripe Checkout).
 *
 * Auth: requires admin_session cookie (same pattern as /api/upload-image).
 *
 * Body (JSON):
 *   customer_name   string  required
 *   customer_email  string  required
 *   customer_phone  string  optional
 *
 * Response: { customer: { id, customer_name, customer_email } }
 *   or      { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertCustomer } from "@/lib/orders";
import { getSessionUser } from "@/lib/approved-auth";

export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { customer_name?: string; customer_email?: string; customer_phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { customer_name, customer_email, customer_phone } = body;

  if (!customer_name || !customer_email) {
    return NextResponse.json({ error: "customer_name and customer_email are required." }, { status: 400 });
  }

  if (!customer_email.includes("@")) {
    return NextResponse.json({ error: "Invalid customer_email." }, { status: 400 });
  }

  try {
    const customerId = await upsertCustomer({
      name: customer_name.trim(),
      email: customer_email.trim().toLowerCase(),
      phone: customer_phone?.trim() ?? null,
    });
    return NextResponse.json({ customer: { id: customerId, customer_name, customer_email } });
  } catch (err) {
    console.error("[create-customer]", err);
    return NextResponse.json({ error: "Failed to create customer." }, { status: 500 });
  }
}
