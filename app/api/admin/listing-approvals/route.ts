/**
 * GET /api/admin/listing-approvals
 *
 * Admin-only queue of employee-submitted listings. Filters: status, employeeId,
 * category, submissionType (first|resubmission), missingSalePrice.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  images: string[] | null;
  listing_status: string | null;
  current_submission_version: number;
  created_by_employee_id: string | null;
  price_display_usd: number | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status"); // AWAITING_APPROVAL | NEEDS_ADJUSTMENT | APPROVED_UNPUBLISHED | PUBLISHED | REJECTED
  const employeeId = searchParams.get("employeeId");
  const category = searchParams.get("category");
  const submissionType = searchParams.get("submissionType"); // "first" | "resubmission"
  const missingSalePrice = searchParams.get("missingSalePrice") === "1";

  let q = supabaseAdmin
    .from("products")
    .select("id, name, category, images, listing_status, current_submission_version, created_by_employee_id, price_display_usd, created_at")
    .not("created_by_employee_id", "is", null)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("listing_status", status);
  if (employeeId) q = q.eq("created_by_employee_id", employeeId);
  if (category) q = q.eq("category", category);
  if (missingSalePrice) q = q.is("price_display_usd", null);
  if (submissionType === "first") q = q.eq("current_submission_version", 1);
  if (submissionType === "resubmission") q = q.gt("current_submission_version", 1);

  const { data: products, error } = await q.returns<ProductRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = products ?? [];
  const productIds = rows.map((r) => r.id);
  const employeeIds = [...new Set(rows.map((r) => r.created_by_employee_id).filter((v): v is string => !!v))];

  const [{ data: employees }, { data: costs }, { data: submissions }] = await Promise.all([
    employeeIds.length > 0
      ? supabaseAdmin.from("employee_profiles").select("user_id, display_name").in("user_id", employeeIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
    productIds.length > 0
      ? supabaseAdmin.from("product_costs").select("product_id, purchase_price_usd, purchase_currency").in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; purchase_price_usd: number; purchase_currency: string }[] }),
    productIds.length > 0
      ? supabaseAdmin
          .from("listing_submissions")
          .select("id, product_id, version, listing_reviews(decision)")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { id: string; product_id: string; version: number; listing_reviews: { decision: string }[] }[] }),
  ]);

  const nameByEmployee = new Map((employees ?? []).map((e) => [e.user_id, e.display_name]));
  const costByProduct = new Map((costs ?? []).map((c) => [c.product_id, c]));
  const adjustmentCountByProduct = new Map<string, number>();
  for (const sub of submissions ?? []) {
    const requestedAdjustment = (sub.listing_reviews ?? []).some((r) => r.decision === "request_adjustment");
    if (requestedAdjustment) {
      adjustmentCountByProduct.set(sub.product_id, (adjustmentCountByProduct.get(sub.product_id) ?? 0) + 1);
    }
  }

  const queue = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    thumbnail: r.images?.[0] ?? null,
    listingStatus: r.listing_status,
    submissionVersion: r.current_submission_version,
    employeeId: r.created_by_employee_id,
    employeeName: r.created_by_employee_id ? (nameByEmployee.get(r.created_by_employee_id) ?? "Unknown") : null,
    cog: costByProduct.get(r.id)?.purchase_price_usd ?? null,
    cogCurrency: costByProduct.get(r.id)?.purchase_currency ?? null,
    hasSalePrice: r.price_display_usd != null,
    createdAt: r.created_at,
    isFirstSubmission: r.current_submission_version === 1,
    priorAdjustmentRequests: adjustmentCountByProduct.get(r.id) ?? 0,
  }));

  return NextResponse.json({ queue });
}
