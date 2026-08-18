import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

// Runs on the Node.js runtime (not Edge) specifically so it can use Node's
// `crypto` to actually verify the approved_session HMAC signature here,
// rather than a format-only regex check — see verifySessionCookie() below.
export const runtime = "nodejs";

const MAINTENANCE_ENABLED = process.env.MAINTENANCE_MODE === "true";
const RETRY_AFTER_SECONDS = "1800";

// Legacy admin/partner paths — a catalog_contributor session must NOT pass
// these, even though it holds a validly-signed approved_session cookie.
const PARTNER_PROTECTED = [
  "/add",
  "/addvendor",
  "/edit",
  "/editvendor",
  "/vendors",
  "/orders-admin",
  "/products-admin",
  "/customers-admin",
  "/approved-users",
  "/sourcing-admin",
  "/claims-admin"
];

// Isolated employee portal — only a catalog_contributor (or admin) session
// may pass. A partner session must NOT pass.
const EMPLOYEE_PROTECTED = ["/employee"];

const MAINTENANCE_ALLOWED = [
  "/maintenance",
  "/_next",
  "/images",
  "/fonts",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/admin",
  "/admin-login",
  "/approved-login",
  "/orders-admin",
  "/products-admin",
  "/customers-admin",
  "/approved-users",
  "/sourcing-admin",
  "/claims-admin",
  "/api",
  "/add",
  "/addvendor",
  "/edit",
  "/editvendor",
  "/vendors",
  "/employee"
];

function isLocalhost(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Verify an approved_session cookie value entirely from the signature —
 * no DB call. Format: "{userId}.{role}.{sessionVersion}.{hmac}". Mirrors
 * verifyApprovedSessionValue() in lib/approved-auth.ts (duplicated locally,
 * not imported, to keep middleware free of the supabase-admin/next-headers
 * dependency graph it would otherwise pull in).
 *
 * This only proves the cookie is validly signed and tells us its role — it
 * does NOT prove the account is still active or that session_version hasn't
 * been bumped since (that DB-backed check happens in getSessionUser(), used
 * by every page/route this middleware lets through). A revoked or suspended
 * session still passes this format check, but is then rejected downstream.
 */
function verifySessionRole(cookieValue: string | undefined): "partner" | "catalog_contributor" | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return null;
  const [userId, role, versionStr, sig] = parts;
  if (role !== "partner" && role !== "catalog_contributor") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) return null;
  if (!/^\d+$/.test(versionStr)) return null;
  const secret = process.env.ADMIN_PASSWORD ?? "dev-fallback-do-not-use-in-prod";
  const expected = createHmac("sha256", secret).update(`${userId}.${role}.${versionStr}`).digest("hex");
  return sig === expected ? role : null;
}

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;

  // Block /studio outside localhost
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    if (!isLocalhost(hostname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    res.headers.set("x-is-studio", "1");
    return res;
  }

  if (MAINTENANCE_ENABLED && !matchesPrefix(pathname, MAINTENANCE_ALLOWED)) {
    const maintenanceUrl = new URL("/maintenance", request.url);
    const res = NextResponse.redirect(maintenanceUrl, 307);
    res.headers.set("Retry-After", RETRY_AFTER_SECONDS);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const isEmployeePath = matchesPrefix(pathname, EMPLOYEE_PROTECTED);
  const isPartnerPath = matchesPrefix(pathname, PARTNER_PROTECTED);
  const isProtected = isEmployeePath || isPartnerPath;

  const withCommonHeaders = (res: NextResponse) => {
    res.headers.set("x-pathname", pathname);
    if (isEmployeePath) res.headers.set("Cache-Control", "no-store");
    return res;
  };

  if (!isProtected) {
    return withCommonHeaders(NextResponse.next());
  }

  const password = process.env.ADMIN_PASSWORD;
  const session = request.cookies.get("admin_session")?.value;

  // Admin passes every protected path, including /employee.
  if (password && session === password) {
    return withCommonHeaders(NextResponse.next());
  }

  const role = verifySessionRole(request.cookies.get("approved_session")?.value);

  // /employee is catalog-contributor-only; the legacy partner-protected
  // paths are partner-only. A validly-signed cookie for the wrong role must
  // not pass either — a catalog contributor must never reach /products-admin,
  // /orders-admin, /vendors, etc., and a partner must never reach /employee.
  const roleAllowed =
    (isEmployeePath && role === "catalog_contributor") ||
    (isPartnerPath && role === "partner");

  if (roleAllowed) {
    return withCommonHeaders(NextResponse.next());
  }

  const loginUrl = new URL(isEmployeePath ? "/approved-login" : "/admin-login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
