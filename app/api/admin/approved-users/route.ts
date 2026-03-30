import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword } from "@/lib/approved-auth";

/** Admin-only — approved users cannot manage other approved users. */
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

// GET — list all approved users
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("approved_users")
    .select("id, email, full_name, access_level, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

// POST — create a new approved user
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: string; fullName?: string; password?: string; accessLevel?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const password = body.password;
  const accessLevel = body.accessLevel ?? "standard";

  if (!email || !fullName || !password) {
    return NextResponse.json({ error: "email, fullName, and password are required." }, { status: 400 });
  }
  if (!["standard", "senior"].includes(accessLevel)) {
    return NextResponse.json({ error: "accessLevel must be 'standard' or 'senior'." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("approved_users")
    .insert({
      email,
      full_name: fullName,
      access_level: accessLevel,
      password_hash: hashPassword(password),
    })
    .select("id, email, full_name, access_level, is_active, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user }, { status: 201 });
}

// PATCH — update an approved user (password, access level, active status)
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; fullName?: string; password?: string; accessLevel?: string; isActive?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.fullName !== undefined) updates.full_name = body.fullName.trim();
  if (body.accessLevel !== undefined) {
    if (!["standard", "senior"].includes(body.accessLevel)) {
      return NextResponse.json({ error: "Invalid accessLevel." }, { status: 400 });
    }
    updates.access_level = body.accessLevel;
  }
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.password !== undefined) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    updates.password_hash = hashPassword(body.password);
  }

  const { data: user, error } = await supabaseAdmin
    .from("approved_users")
    .update(updates)
    .eq("id", body.id)
    .select("id, email, full_name, access_level, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user });
}

// DELETE — permanently remove an approved user
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { error } = await supabaseAdmin.from("approved_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
