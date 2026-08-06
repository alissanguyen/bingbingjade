import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword } from "@/lib/approved-auth";
import { logAudit } from "@/lib/audit";

/** Admin-only — approved users cannot manage other approved users. */
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

const USER_SELECT = "id, email, full_name, access_level, role, is_active, session_version, generation_tokens, created_at";

// GET — list all approved users (partners and catalog contributors), with
// employee_profiles embedded for catalog contributors.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("approved_users")
    .select(`${USER_SELECT}, employee_profiles(*)`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

// POST — create a new approved user (partner or catalog contributor)
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    email?: string;
    fullName?: string;
    password?: string;
    accessLevel?: string;
    role?: string;
    bio?: string;
    ratePerApprovedListing?: number;
    startDate?: string;
    canViewVendors?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const password = body.password;
  const accessLevel = body.accessLevel ?? "standard";
  const role = body.role ?? "partner";

  if (!email || !fullName || !password) {
    return NextResponse.json({ error: "email, fullName, and password are required." }, { status: 400 });
  }
  if (!["standard", "senior"].includes(accessLevel)) {
    return NextResponse.json({ error: "accessLevel must be 'standard' or 'senior'." }, { status: 400 });
  }
  if (!["partner", "catalog_contributor"].includes(role)) {
    return NextResponse.json({ error: "role must be 'partner' or 'catalog_contributor'." }, { status: 400 });
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
      role,
      password_hash: hashPassword(password),
    })
    .select(USER_SELECT)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (role === "catalog_contributor") {
    const rate = Number(body.ratePerApprovedListing ?? 0);
    const { error: profileError } = await supabaseAdmin.from("employee_profiles").insert({
      user_id: user.id,
      display_name: fullName,
      bio: body.bio?.trim() || null,
      start_date: body.startDate || new Date().toISOString().slice(0, 10),
      default_rate_per_approved_listing: Number.isFinite(rate) ? rate : 0,
      can_view_vendors: body.canViewVendors === true,
    });

    if (profileError) {
      // Compensating delete — don't leave an employee account with no profile.
      await supabaseAdmin.from("approved_users").delete().eq("id", user.id);
      return NextResponse.json({ error: `Failed to create employee profile: ${profileError.message}` }, { status: 500 });
    }
  }

  await logAudit({
    actorUserId: "admin",
    action: "create_account",
    entityType: "approved_user",
    entityId: user.id,
    newValue: { email, role, accessLevel },
  });

  return NextResponse.json({ user }, { status: 201 });
}

// PATCH — update an approved user (password, access level, active status,
// role-specific fields) or trigger a session revocation.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    fullName?: string;
    password?: string;
    accessLevel?: string;
    isActive?: boolean;
    revokeSessions?: boolean;
    // employee_profiles fields (only applied if the target user is a catalog_contributor)
    bio?: string;
    avatarUrl?: string;
    ratePerApprovedListing?: number;
    employeeStatus?: "active" | "suspended" | "terminated";
    canViewVendors?: boolean;
    /** Additive — added to the user's current generation_tokens balance, not an absolute set. */
    grantTokens?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("approved_users")
    .select("id, role, is_active, session_version, generation_tokens")
    .eq("id", body.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

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
  if (body.revokeSessions) {
    updates.session_version = existing.session_version + 1;
  }
  if (body.grantTokens !== undefined) {
    const grantAmount = Number(body.grantTokens);
    if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
      return NextResponse.json({ error: "grantTokens must be a positive number." }, { status: 400 });
    }
    updates.generation_tokens = (existing.generation_tokens ?? 0) + Math.round(grantAmount);
  }

  // employee_profiles.status drives login access for catalog contributors:
  // suspending/terminating immediately blocks login (is_active=false), and
  // reactivating restores it. This is the one control an admin needs instead
  // of separately juggling is_active and employee_profiles.status.
  if (existing.role === "catalog_contributor" && body.employeeStatus !== undefined) {
    if (!["active", "suspended", "terminated"].includes(body.employeeStatus)) {
      return NextResponse.json({ error: "Invalid employeeStatus." }, { status: 400 });
    }
    updates.is_active = body.employeeStatus === "active";
    // Suspending/terminating also revokes any live session immediately.
    if (body.employeeStatus !== "active") updates.session_version = existing.session_version + 1;
  }

  const { data: user, error } = await supabaseAdmin
    .from("approved_users")
    .update(updates)
    .eq("id", body.id)
    .select(USER_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.role === "catalog_contributor") {
    const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.fullName !== undefined) profileUpdates.display_name = body.fullName.trim();
    if (body.bio !== undefined) profileUpdates.bio = body.bio.trim() || null;
    if (body.avatarUrl !== undefined) profileUpdates.avatar_url = body.avatarUrl || null;
    if (body.ratePerApprovedListing !== undefined) {
      const rate = Number(body.ratePerApprovedListing);
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: "Invalid ratePerApprovedListing." }, { status: 400 });
      }
      profileUpdates.default_rate_per_approved_listing = rate;
    }
    if (body.employeeStatus !== undefined) profileUpdates.status = body.employeeStatus;
    if (body.canViewVendors !== undefined) profileUpdates.can_view_vendors = body.canViewVendors === true;

    if (Object.keys(profileUpdates).length > 1) {
      await supabaseAdmin.from("employee_profiles").update(profileUpdates).eq("user_id", body.id);
    }
  }

  await logAudit({
    actorUserId: "admin",
    action: body.revokeSessions ? "revoke_sessions" : body.grantTokens !== undefined ? "grant_tokens" : "update_account",
    entityType: "approved_user",
    entityId: body.id,
    previousValue: existing,
    newValue: updates,
  });

  return NextResponse.json({ user });
}

// DELETE — permanently remove an approved user. Blocked for any account with
// listing/payout history (the DB's ON DELETE RESTRICT on listing_submissions/
// listing_approval_credits/employee_payouts enforces this too, but we check
// first here to return a clear error instead of a raw FK-violation message).
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { count } = await supabaseAdmin
    .from("listing_approval_credits")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This account has approval/payout history and cannot be deleted. Suspend or terminate it instead." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from("approved_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorUserId: "admin", action: "delete_account", entityType: "approved_user", entityId: id });

  return NextResponse.json({ ok: true });
}
