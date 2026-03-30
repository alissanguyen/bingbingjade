import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPassword, signApprovedUserId } from "@/lib/approved-auth";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("approved_users")
    .select("id, email, full_name, access_level, password_hash, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const cookieValue = signApprovedUserId(user.id);

  const res = NextResponse.json({ ok: true, user: { email: user.email, full_name: user.full_name, access_level: user.access_level } });
  res.cookies.set("approved_session", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
