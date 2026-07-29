/**
 * GET /api/employee/media?path=wm/xxxx.webp
 *
 * Resolves a short-lived signed URL for an object in the private
 * jade-employee-drafts bucket. This is the only way to read draft media —
 * there is no public/anon access to that bucket at all (migration_112).
 *
 * Authorization: the caller must be the catalog-contributor employee who
 * owns the product currently referencing this path, or an admin. Ownership
 * is re-derived from the products table on every request (never trusted
 * from the client) by reverse-looking-up which product's images/videos
 * array contains this exact path.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin, isCatalogContributor } from "@/lib/approved-auth";
import { resolveEmployeeDraftUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !(isAdmin(session) || isCatalogContributor(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path || path.includes("..") || path.startsWith("/") || path.startsWith("http")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const [{ data: byImage }, { data: byVideo }] = await Promise.all([
    supabaseAdmin.from("products").select("id, created_by_employee_id").contains("images", [path]).maybeSingle(),
    supabaseAdmin.from("products").select("id, created_by_employee_id").contains("videos", [path]).maybeSingle(),
  ]);
  const product = byImage ?? byVideo;

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isCatalogContributor(session) && product.created_by_employee_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await resolveEmployeeDraftUrl(path);
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = NextResponse.json({ url });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
