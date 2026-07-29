/**
 * Approved-user authentication helpers.
 *
 * Session cookie format:
 *   "approved_session" = "{userId}.{role}.{sessionVersion}.{HMAC-SHA256(userId+role+sessionVersion, ADMIN_PASSWORD)}"
 * - Middleware can verify the signature with a regex + HMAC check (no DB needed) AND
 *   read the role straight off the cookie, so it can gate `catalog_contributor`
 *   sessions away from the legacy partner-only admin paths without a DB round trip.
 * - Pages / API routes call getSessionUser() which adds the DB active-status check
 *   AND compares sessionVersion against approved_users.session_version — an admin
 *   revoking sessions just increments that column, instantly invalidating every
 *   outstanding cookie for that user without a server-side session table.
 * - Role is always re-read from the DB in getSessionUser() (source of truth) —
 *   the cookie's role is only a fast, tamper-evident hint for middleware.
 *
 * Passwords are stored as "salt:pbkdf2-sha256-hash" using Node.js crypto (no deps).
 *
 * SERVER-ONLY — never import this in client components.
 */

import { createHmac, pbkdf2Sync, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovedRole = "partner" | "catalog_contributor";

export type ApprovedUser = {
  id: string;
  email: string;
  full_name: string;
  access_level: "standard" | "senior";
  role: ApprovedRole;
};

export type SessionUser =
  | { type: "admin" }
  | { type: "approved"; user: ApprovedUser };

// ── Password helpers ───────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = pbkdf2Sync(password, salt, 100_000, 64, "sha256").toString("hex");
  return attempt === hash;
}

// ── Session cookie helpers ────────────────────────────────────────────────────

function secret(): string {
  return process.env.ADMIN_PASSWORD ?? "dev-fallback-do-not-use-in-prod";
}

/** Create the signed cookie value for an approved user session. */
export function signApprovedUserId(userId: string, role: ApprovedRole, sessionVersion: number): string {
  const payload = `${userId}.${role}.${sessionVersion}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Verify the cookie value.
 * Returns the userId + role + sessionVersion if the signature is valid, null
 * otherwise. Rejects the legacy 2-part ("{userId}.{sig}") format on purpose —
 * those sessions predate role-awareness and must re-authenticate once.
 */
export function verifyApprovedSessionValue(
  value: string
): { userId: string; role: ApprovedRole; sessionVersion: number } | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [userId, role, versionStr, sig] = parts;
  if (role !== "partner" && role !== "catalog_contributor") return null;
  if (!/^\d+$/.test(versionStr)) return null;
  const payload = `${userId}.${role}.${versionStr}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  return sig === expected ? { userId, role, sessionVersion: Number(versionStr) } : null;
}

// ── Main session resolver ─────────────────────────────────────────────────────

/**
 * Determine the current user type from request cookies.
 *
 * - Admin:    admin_session cookie matches ADMIN_PASSWORD
 * - Approved: approved_session cookie is validly signed AND the user exists + is active
 * - null:     unauthenticated
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();

  // Admin check (existing system — unchanged)
  const adminSession = cookieStore.get("admin_session")?.value;
  if (adminSession && adminSession === process.env.ADMIN_PASSWORD) {
    return { type: "admin" };
  }

  // Approved user check
  const approvedSession = cookieStore.get("approved_session")?.value;
  if (approvedSession) {
    const verified = verifyApprovedSessionValue(approvedSession);
    if (verified) {
      const { data: user } = await supabaseAdmin
        .from("approved_users")
        .select("id, email, full_name, access_level, role, session_version")
        .eq("id", verified.userId)
        .eq("is_active", true)
        .maybeSingle();

      // session_version must match exactly — an admin-triggered "revoke all
      // sessions" bumps this column, which instantly invalidates any cookie
      // signed with the old version, even though the signature itself is
      // still cryptographically valid.
      if (user && user.session_version === verified.sessionVersion) {
        return { type: "approved", user: user as ApprovedUser };
      }
    }
  }

  return null;
}

/** Returns true only when the session belongs to the site admin. */
export function isAdmin(session: SessionUser | null): session is Extract<SessionUser, { type: "admin" }> {
  return session?.type === "admin";
}

/**
 * Returns true when the session belongs to a legacy "partner" approved user
 * — the trusted role with broad visibility (orders, customers, vendors,
 * pricing). Deliberately excludes catalog_contributor: this is the single
 * choke point that keeps the ~100 existing `app/api/admin/**` routes that
 * gate on isApproved()/getSessionUser() closed to the new, far more
 * restricted employee role without having to audit every route individually.
 *
 * Declared as a type predicate (not just `boolean`) so `if (isApproved(session))`
 * also narrows `session.user` for TypeScript — this is a type-level-only
 * change, the runtime check is unchanged, so every existing call site keeps
 * working exactly as before.
 */
export function isApproved(session: SessionUser | null): session is Extract<SessionUser, { type: "approved" }> {
  return session?.type === "approved" && session.user.role === "partner";
}

/** Returns true when the session belongs to a Catalog Contributor employee. */
export function isCatalogContributor(session: SessionUser | null): session is Extract<SessionUser, { type: "approved" }> {
  return session?.type === "approved" && session.user.role === "catalog_contributor";
}

/** created_by value for an approved-user-created record. */
export function approvedCreatedBy(userId: string): string {
  return `approved:${userId}`;
}
