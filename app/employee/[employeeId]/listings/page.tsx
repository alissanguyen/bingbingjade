export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEmployeeDraftUrl, productThumbUrl } from "@/lib/storage";
import { StatusBadge } from "@/app/employee/StatusBadge";

type ListingRow = {
  id: string;
  name: string;
  category: string;
  images: string[];
  listing_status: string | null;
  current_submission_version: number;
  created_at: string;
};

async function resolveThumb(row: ListingRow): Promise<string | null> {
  const path = row.images?.[0];
  if (!path) return null;
  if (row.listing_status === "PUBLISHED") return productThumbUrl(path);
  return resolveEmployeeDraftUrl(path);
}

export default async function EmployeeListingsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const { data } = await supabaseAdmin
    .from("products")
    .select("id, name, category, images, listing_status, current_submission_version, created_at")
    .eq("created_by_employee_id", employeeId)
    .order("created_at", { ascending: false })
    .returns<ListingRow[]>();

  const rows = data ?? [];
  const thumbs = await Promise.all(rows.map(resolveThumb));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Listings</h1>
        <Link
          href={`/employee/${employeeId}/add`}
          className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          + Add Listing
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">You haven&apos;t created any listings yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => {
            const editable = row.listing_status === "EMPLOYEE_DRAFT" || row.listing_status === "NEEDS_ADJUSTMENT";
            return (
              <div key={row.id} className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                  {thumbs[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[i]!} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{row.name || "Untitled listing"}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                    {row.category} · v{row.current_submission_version || 1} · {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={row.listing_status} />
                {editable && (
                  <Link
                    href={`/employee/${employeeId}/listings/${row.id}/edit`}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    Edit
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
