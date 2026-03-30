/**
 * Approved-user authentication helpers.
 *
 * Session cookie format: "approved_session" = "{userId}.{HMAC-SHA256(userId, ADMIN_PASSWORD)}"
 * - Middleware can verify the signature with a regex + HMAC check (no DB needed).
 * - Pages / API routes call getSessionUser() which adds the DB active-status check.
 *
 * Passwords are stored as "salt:pbkdf2-sha256-hash" using Node.js crypto (no deps).
 *
 * SERVER-ONLY — never import this in client components.
 */

import { createHmac, pbkdf2Sync, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase-admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovedUser = {
  id: string;
  email: string;
  full_name: string;
  access_level: "standard" | "senior";
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
export function signApprovedUserId(userId: string): string {
  const sig = createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

/**
 * Verify the cookie value.
 * Returns the userId if the signature is valid, null otherwise.
 */
export function verifyApprovedSessionValue(value: string): string | null {
  const dot = value.indexOf(".");
  if (dot === -1) return null;
  const userId = value.substring(0, dot);
  const sig = value.substring(dot + 1);
  const expected = createHmac("sha256", secret()).update(userId).digest("hex");
  return sig === expected ? userId : null;
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
    const userId = verifyApprovedSessionValue(approvedSession);
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from("approved_users")
        .select("id, email, full_name, access_level")
        .eq("id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (user) {
        return { type: "approved", user: user as ApprovedUser };
      }
    }
  }

  return null;
}

/** Returns true only when the session belongs to the site admin. */
export function isAdmin(session: SessionUser | null): boolean {
  return session?.type === "admin";
}

/** Returns true when the session belongs to an approved (non-admin) user. */
export function isApproved(session: SessionUser | null): boolean {
  return session?.type === "approved";
}

/** created_by value for an approved-user-created record. */
export function approvedCreatedBy(userId: string): string {
  return `approved:${userId}`;
}
