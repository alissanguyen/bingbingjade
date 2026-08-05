export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEmployeeCanViewVendors } from "@/lib/employee-permissions";
import { EditForm } from "@/app/edit/[id]/EditForm";
import { saveEmployeeDraft, submitEmployeeListing } from "@/app/employee/actions";
import { StatusBadge } from "@/app/employee/StatusBadge";
import type { ProductCategory } from "@/types/product";

// Explicit allowlist — price/financial columns are never selected here, so
// there is no value for them to leak into the client component's
// props/state even if a future edit accidentally rendered them. vendor_id
// is appended conditionally below, only for employees with vendor visibility.
const EMPLOYEE_SAFE_SELECT =
  "id, name, category, origin, images, videos, color, tier, size, size_detailed, is_oval, wrist_size, " +
  "description, blemishes, sourcing_notes, quick_ship, listing_status, created_by_employee_id, current_submission_version";

type EmployeeSafeRow = {
  id: string;
  name: string;
  category: ProductCategory;
  origin: string;
  images: string[] | null;
  videos: string[] | null;
  color: string[] | null;
  tier: string[] | null;
  size: string | null;
  size_detailed: (number | null)[] | null;
  is_oval: boolean;
  wrist_size: string | null;
  description: string | null;
  blemishes: string | null;
  sourcing_notes: string | null;
  quick_ship: boolean;
  listing_status: string | null;
  created_by_employee_id: string | null;
  current_submission_version: number;
  vendor_id?: string | null;
};

export default async function EmployeeEditListingPage({
  params,
}: {
  params: Promise<{ employeeId: string; listingId: string }>;
}) {
  const { employeeId, listingId } = await params;

  const canViewVendors = await getEmployeeCanViewVendors(employeeId);
  const select = canViewVendors ? `${EMPLOYEE_SAFE_SELECT}, vendor_id` : EMPLOYEE_SAFE_SELECT;

  const { data: row } = await supabaseAdmin
    .from("products")
    .select(select)
    .eq("id", listingId)
    .maybeSingle<EmployeeSafeRow>();

  // Same generic "not found" for a nonexistent listing and one that belongs
  // to a different employee — no signal either way.
  if (!row || row.created_by_employee_id !== employeeId) notFound();

  const editable = row.listing_status === "EMPLOYEE_DRAFT" || row.listing_status === "NEEDS_ADJUSTMENT";

  if (!editable) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{row.name || "Untitled listing"}</h1>
          <StatusBadge status={row.listing_status} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This listing can&apos;t be edited right now.
          {row.listing_status === "AWAITING_APPROVAL" && " It's awaiting admin review."}
          {(row.listing_status === "APPROVED_UNPUBLISHED" || row.listing_status === "PUBLISHED") &&
            " It has already been approved — an admin can return it for adjustment if changes are needed."}
          {row.listing_status === "REJECTED" && " It was rejected and is no longer editable."}
        </p>
      </div>
    );
  }

  const [{ data: costRow }, { data: vendors }] = await Promise.all([
    supabaseAdmin.from("product_costs").select("purchase_price_original, purchase_currency").eq("product_id", listingId).maybeSingle(),
    canViewVendors ? supabaseAdmin.from("vendors").select("*").order("name") : Promise.resolve({ data: [] }),
  ]);

  const product = {
    id: row.id,
    name: row.name,
    category: row.category,
    origin: row.origin,
    images: row.images ?? [],
    videos: row.videos ?? [],
    color: row.color ?? [],
    tier: row.tier ?? [],
    size: row.size,
    size_detailed: row.size_detailed,
    is_oval: row.is_oval,
    wrist_size: row.wrist_size,
    description: row.description,
    blemishes: row.blemishes,
    sourcing_notes: row.sourcing_notes,
    // Admin-only fields — deliberately never fetched above; these are
    // placeholders only, never real values, so nothing to leak.
    price_display_usd: null,
    sale_price_usd: null,
    imported_price_vnd: 0,
    show_price: true,
    vendor_id: canViewVendors ? (row.vendor_id ?? "") : "",
    is_featured: false,
    is_clearance: false,
    is_published: false,
    quick_ship: row.quick_ship,
    status: "available" as const,
    renewed_at: null,
    reserved_until: null,
    reserved_for_handle: null,
    created_by_employee_id: row.created_by_employee_id,
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Edit Listing</h1>
      <EditForm
        product={product}
        vendors={vendors ?? []}
        canViewVendors={canViewVendors}
        mode="employee-edit"
        sku={null}
        initialCostCurrency={costRow?.purchase_currency === "CNY" ? "CNY" : "VND"}
        initialCostAmount={costRow?.purchase_price_original ?? null}
        onEmployeeSubmit={submitEmployeeListing}
        onEmployeeSaveDraft={saveEmployeeDraft}
      />
    </div>
  );
}
