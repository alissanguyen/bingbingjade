export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { EditForm } from "@/app/edit/[id]/EditForm";
import { resolveImageUrls, resolveVideoUrls, resolveEmployeeDraftUrl, isStoragePath } from "@/lib/storage";
import { ReviewActionsPanel } from "./ReviewActionsPanel";
import { generateSku } from "@/lib/slug";
import type { OptionStatus } from "@/types/product";

interface InitialOptionRaw {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  sale_price_usd: number | null;
  status: OptionStatus;
  image_index: number | null;
}

export default async function ListingApprovalDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const { listingId } = await params;

  const [{ data: product }, { data: vendors }, optionsResult] = await Promise.all([
    supabaseAdmin.from("products").select("*").eq("id", listingId).single(),
    supabaseAdmin.from("vendors").select("*").order("name"),
    supabaseAdmin
      .from("product_options")
      .select("id, label, size, price_usd, sale_price_usd, status, image_index")
      .eq("product_id", listingId)
      .order("sort_order"),
  ]);

  if (!product || !product.created_by_employee_id) notFound();

  // Self-heal listings submitted before SKU generation was wired up for the
  // employee flow — backfill once, in place, so item-origin lookups work
  // for listings that already exist rather than only new ones going forward.
  if (!product.sku) {
    product.sku = generateSku();
    await supabaseAdmin.from("products").update({ sku: product.sku }).eq("id", listingId);
  }

  const stillInDraftBucket = product.listing_status !== "PUBLISHED";
  const imagePaths: string[] = product.images ?? [];
  const videoPaths: string[] = product.videos ?? [];

  const [resolvedImages, resolvedVideos] = stillInDraftBucket
    ? await Promise.all([
        Promise.all(imagePaths.map(async (p) => (isStoragePath(p) ? (await resolveEmployeeDraftUrl(p)) ?? p : p))),
        Promise.all(videoPaths.map(async (p) => (isStoragePath(p) ? (await resolveEmployeeDraftUrl(p)) ?? p : p))),
      ])
    : await Promise.all([
        imagePaths.some(isStoragePath) ? resolveImageUrls(imagePaths) : Promise.resolve(imagePaths),
        videoPaths.some(isStoragePath) ? resolveVideoUrls(videoPaths) : Promise.resolve(videoPaths),
      ]);

  const [{ data: employeeProfile }, { data: cost }, { data: financials }, { data: submissions }] = await Promise.all([
    supabaseAdmin.from("employee_profiles").select("display_name").eq("user_id", product.created_by_employee_id).maybeSingle(),
    supabaseAdmin.from("product_costs").select("purchase_price_original, purchase_currency").eq("product_id", listingId).maybeSingle(),
    supabaseAdmin.from("admin_product_financials").select("*").eq("product_id", listingId).maybeSingle(),
    supabaseAdmin
      .from("listing_submissions")
      .select("id, version, submitted_at, listing_reviews(decision, employee_visible_feedback, private_admin_notes, reviewed_at)")
      .eq("product_id", listingId)
      .order("version", { ascending: false }),
  ]);

  const productWithUrls = { ...product, images: resolvedImages, videos: resolvedVideos };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">
            Reviewing listing from {employeeProfile?.display_name ?? "Unknown employee"}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{product.name}</h1>
          <EditForm
            product={productWithUrls}
            vendors={vendors ?? []}
            initialOptions={(optionsResult.data ?? []) as InitialOptionRaw[]}
            mode="admin"
            hasPendingApproval={false}
            sku={product.sku ?? null}
          />
        </div>

        <ReviewActionsPanel
          listingId={listingId}
          currentStatus={product.listing_status}
          cog={cost?.purchase_price_original ?? null}
          cogCurrency={cost?.purchase_currency ?? null}
          existingSalePrice={product.price_display_usd}
          existingFinancials={financials ?? null}
          submissionHistory={(submissions ?? []).map((s) => ({
            version: s.version,
            submittedAt: s.submitted_at,
            review: (s.listing_reviews as unknown as { decision: string; employee_visible_feedback: string | null; private_admin_notes: string | null; reviewed_at: string }[])?.[0] ?? null,
          }))}
        />
      </div>
    </div>
  );
}
