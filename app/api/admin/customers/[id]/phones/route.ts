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
  const body = await req.json().catch(() => ({})) as { phone?: string; label?: string };

  if (!body.phone?.trim()) {
    return NextResponse.json({ error: "phone is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customer_phones")
    .insert({ customer_id: id, phone: body.phone.trim(), label: body.label?.trim() || "Mobile" })
    .select("id, phone, label, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phone: data });
}
