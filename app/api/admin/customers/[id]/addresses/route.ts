import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    recipientName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
  };

  if (!body.line1?.trim() || !body.city?.trim() || !body.state?.trim() || !body.postal?.trim()) {
    return NextResponse.json({ error: "line1, city, state and postal are required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customer_addresses")
    .insert({
      customer_id: id,
      recipient_name: body.recipientName?.trim() ?? null,
      address_line1: body.line1.trim(),
      address_line2: body.line2?.trim() ?? null,
      city: body.city.trim(),
      state_or_region: body.state.trim(),
      postal_code: body.postal.trim(),
      country: body.country?.trim() ?? "US",
    })
    .select("id, recipient_name, address_line1, address_line2, city, state_or_region, postal_code, country, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ address: data });
}
