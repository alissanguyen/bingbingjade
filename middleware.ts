import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/add", "/addvendor", "/edit", "/editvendor", "/vendors", "/orders-admin", "/products-admin", "/customers-admin", "/approved-users"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isProtected) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const password = process.env.ADMIN_PASSWORD;
  const session = request.cookies.get("admin_session")?.value;

  if (password && session === password) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  // Also allow approved users: cookie format is "{uuid}.{64-hex-chars}"
  const approvedSession = request.cookies.get("approved_session")?.value;
  const isApprovedFormat = approvedSession
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{64}$/.test(approvedSession)
    : false;

  if (isApprovedFormat) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const loginUrl = new URL("/admin-login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
