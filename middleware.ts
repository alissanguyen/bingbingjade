import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/add", "/addvendor", "/edit"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isProtected) return NextResponse.next();

  const password = process.env.ADMIN_PASSWORD;
  const session = request.cookies.get("admin_session")?.value;

  if (!password || session !== password) {
    const loginUrl = new URL("/admin-login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/add", "/add/:path*", "/addvendor", "/edit", "/edit/:path*"],
};
