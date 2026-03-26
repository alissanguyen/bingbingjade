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
  const body = await req.json().catch(() => ({})) as { email?: string; label?: string };

  if (!body.email?.trim()) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customer_emails")
    .insert({ customer_id: id, email: body.email.trim().toLowerCase(), label: body.label?.trim() || "Primary" })
    .select("id, email, label, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "This email is already saved for this customer." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ email: data });
}
