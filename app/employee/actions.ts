"use server";

/**
 * Server actions for the Catalog Contributor employee portal.
 *
 * Every action re-derives the caller's identity from the session cookie
 * server-side (never trusts a client-supplied employeeId/productId beyond
 * using it to look up a row whose ownership is then checked). Field writes
 * use an explicit allowlist (fieldsToRow) — price/options fields are never
 * read from the incoming FormData at all, so there is no path by which an
 * employee request could set them even by forging extra fields. vendor_id
 * is the one field-level permission that varies per employee
 * (employee_profiles.can_view_vendors) — see fieldsToRow below, which
 * re-checks that flag itself rather than trusting whatever the client sent.
 */

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isCatalogContributor } from "@/lib/approved-auth";
import { slugify, generatePublicId } from "@/lib/slug";
import { logAudit } from "@/lib/audit";
import { getEmployeeCanViewVendors } from "@/lib/employee-permissions";
import { toStoragePath } from "@/lib/storage";

type EmployeeFields = {
  name: string;
  category: string;
  origin: string;
  size: string;
  color: string[];
  tier: string[];
  quick_ship: boolean;
  is_oval: boolean;
  wrist_size: string | null;
  sourcing_notes: string | null;
  description: string | null;
  blemishes: string | null;
  images: string[];
  videos: string[];
  /** Raw, untrusted — only ever applied by fieldsToRow if canViewVendors is true. */
  vendorId: string | null;
};

function extractFields(formData: FormData): EmployeeFields {
  return {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    origin: String(formData.get("origin") ?? "Myanmar"),
    size: String(formData.get("size") ?? ""),
    color: formData.getAll("color").map(String),
    tier: formData.getAll("tier").map(String),
    quick_ship: formData.get("quick_ship") === "true",
    is_oval: formData.get("is_oval") === "true",
    wrist_size: (formData.get("wrist_size") as string) || null,
    sourcing_notes: (formData.get("sourcing_notes") as string) || null,
    description: (formData.get("description") as string) || null,
    blemishes: (formData.get("blemishes") as string) || null,
    // Defensive normalization (mirrors app/edit/[id]/actions.ts): should
    // always be bare wm/ paths already in the employee flow since the
    // client never resolves a signed draft URL for these fields, but this
    // guards against the same class of bug reaching products.images from
    // this write path too if that ever changes.
    images: formData.getAll("imageUrls").map(String).filter(Boolean).map(toStoragePath),
    videos: formData.getAll("videoUrls").map(String).filter(Boolean).map(toStoragePath),
    vendorId: (formData.get("vendor_id") as string) || null,
  };
}

/**
 * canViewVendors is re-derived server-side (never trusted from the request)
 * — a forged vendor_id field in the FormData is silently dropped for any
 * employee whose employee_profiles.can_view_vendors is false, regardless of
 * what the client-side form happened to render.
 */
function fieldsToRow(fields: EmployeeFields, canViewVendors: boolean) {
  return {
    name: fields.name,
    category: fields.category,
    origin: fields.origin,
    size: fields.size,
    color: fields.color,
    tier: fields.tier,
    quick_ship: fields.quick_ship,
    is_oval: fields.is_oval,
    wrist_size: fields.wrist_size,
    sourcing_notes: fields.sourcing_notes,
    description: fields.description,
    blemishes: fields.blemishes,
    images: fields.images,
    videos: fields.videos,
    ...(canViewVendors ? { vendor_id: fields.vendorId } : {}),
  };
}

type CostCurrency = "VND" | "CNY";

// Yuan is never entered directly as an import price — it's converted to VND
// so it lands in the same products.imported_price_vnd field admin-created
// listings already use for COGS-at-sale accounting (see the webhook's
// cogsCents calculation, which reads this column directly). 3950 is the
// VND-per-CNY rate; 1.1 is the markup applied on top.
const YUAN_TO_VND_RATE = 3950;
const YUAN_MARKUP = 1.1;

function extractContributorCost(
  formData: FormData
): { currency: CostCurrency; amount: number; importedPriceVnd: number } | null {
  const raw = formData.get("costAmount");
  if (raw === null || raw === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency: CostCurrency = formData.get("costCurrency") === "CNY" ? "CNY" : "VND";
  const importedPriceVnd = Math.round(currency === "CNY" ? amount * YUAN_TO_VND_RATE * YUAN_MARKUP : amount);
  return { currency, amount, importedPriceVnd };
}

/**
 * Applies the contributor-reported cost: sets products.imported_price_vnd —
 * the same field admin-created listings use, so employee-submitted listings
 * are no longer excluded from COGS-at-sale accounting — and records the
 * original currency/amount in product_costs for provenance and display in
 * the admin review panel. Not part of fieldsToRow's allowlist (see file
 * header) — the VND figure is always server-computed from a validated
 * numeric amount + currency, never trusted directly from the client.
 */
async function applyContributorCost(productId: string, formData: FormData): Promise<void> {
  const cost = extractContributorCost(formData);
  if (!cost) return;
  await supabaseAdmin.from("products").update({ imported_price_vnd: cost.importedPriceVnd }).eq("id", productId);
  await supabaseAdmin.from("product_costs").upsert(
    {
      product_id: productId,
      purchase_price_original: cost.amount,
      purchase_currency: cost.currency,
      cost_last_updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id" }
  );
}

async function requireEmployeeId(): Promise<string> {
  const session = await getSessionUser();
  if (!session || !isCatalogContributor(session)) {
    throw new Error("Unauthorized.");
  }
  return session.user.id;
}

/** Insert a new EMPLOYEE_DRAFT product row. Returns the new product id. */
async function insertDraft(employeeId: string, fields: EmployeeFields, canViewVendors: boolean): Promise<string> {
  if (!fields.name) throw new Error("Name is required.");
  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      ...fieldsToRow(fields, canViewVendors),
      slug: slugify(fields.name),
      public_id: generatePublicId(),
      created_by: "employee",
      created_by_employee_id: employeeId,
      listing_status: "EMPLOYEE_DRAFT",
      is_published: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create draft.");
  return data.id;
}

/** Verify the employee owns productId and it's currently in an editable state. */
async function requireEditableOwnedDraft(employeeId: string, productId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("products")
    .select("id, created_by_employee_id, listing_status")
    .eq("id", productId)
    .maybeSingle();

  // Deliberately the same generic error whether the row doesn't exist or
  // belongs to someone else — an employee must not be able to distinguish
  // "not found" from "not yours" for another employee's listing ID.
  if (!data || data.created_by_employee_id !== employeeId) {
    throw new Error("Listing not found.");
  }
  if (data.listing_status !== "EMPLOYEE_DRAFT" && data.listing_status !== "NEEDS_ADJUSTMENT") {
    throw new Error("This listing can no longer be edited.");
  }
}

// ── Save Draft ────────────────────────────────────────────────────────────────
// Works for both the Add page (no productId yet — creates, then redirects to
// the new draft's edit page) and the Edit page (productId present — updates
// in place, stays on the page).
//
// Returns { error } instead of throwing on failure — matching updateProduct's
// convention (app/edit/[id]/actions.ts) — because Next.js redacts a Server
// Action's thrown Error message to a generic "An error occurred in the Server
// Components render..." string in production builds, so a plain `throw` here
// would make every validation/ownership error (not just unexpected bugs)
// unreadable to the caller. unstable_rethrow lets the internal redirect()
// calls below still navigate normally — only real errors get converted.
export async function saveEmployeeDraft(formData: FormData): Promise<{ error: string } | void> {
  try {
    const employeeId = await requireEmployeeId();
    const canViewVendors = await getEmployeeCanViewVendors(employeeId);
    const fields = extractFields(formData);
    const productId = String(formData.get("productId") ?? "");

    if (productId) {
      await requireEditableOwnedDraft(employeeId, productId);
      if (!fields.name) throw new Error("Name is required.");
      const { error } = await supabaseAdmin.from("products").update(fieldsToRow(fields, canViewVendors)).eq("id", productId);
      if (error) throw new Error(error.message);
      await applyContributorCost(productId, formData);
      revalidatePath(`/employee/${employeeId}/listings/${productId}/edit`);
      return;
    }

    const newId = await insertDraft(employeeId, fields, canViewVendors);
    await applyContributorCost(newId, formData);
    revalidatePath(`/employee/${employeeId}/listings`);
    redirect(`/employee/${employeeId}/listings/${newId}/edit`);
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Failed to save draft." };
  }
}

// ── Submit for Approval ────────────────────────────────────────────────────────
// Handles a first-time submission (no productId — creates then submits) and a
// resubmission after NEEDS_ADJUSTMENT (productId present) identically; the
// fn_submit_listing DB function is what actually enforces the status/ownership
// invariants atomically (see migration_113) and creates the versioned
// submission snapshot.
//
// Returns { error } instead of throwing — see saveEmployeeDraft's comment above.
export async function submitEmployeeListing(formData: FormData): Promise<{ error: string } | void> {
  try {
    const employeeId = await requireEmployeeId();
    const canViewVendors = await getEmployeeCanViewVendors(employeeId);
    const fields = extractFields(formData);
    if (!fields.name) throw new Error("Name is required.");
    if (fields.images.length === 0) throw new Error("At least one photo is required to submit.");

    let productId = String(formData.get("productId") ?? "");

    if (productId) {
      await requireEditableOwnedDraft(employeeId, productId);
      const { error } = await supabaseAdmin.from("products").update(fieldsToRow(fields, canViewVendors)).eq("id", productId);
      if (error) throw new Error(error.message);
    } else {
      productId = await insertDraft(employeeId, fields, canViewVendors);
    }

    const cost = extractContributorCost(formData);
    await applyContributorCost(productId, formData);

    const snapshot = {
      ...fieldsToRow(fields, canViewVendors),
      costCurrency: cost?.currency ?? null,
      costAmount: cost?.amount ?? null,
      importedPriceVnd: cost?.importedPriceVnd ?? null,
    };
    const { error: rpcError } = await supabaseAdmin.rpc("fn_submit_listing", {
      p_product_id: productId,
      p_employee_id: employeeId,
      p_snapshot: snapshot,
    });
    if (rpcError) throw new Error(rpcError.message);

    await logAudit({
      actorUserId: employeeId,
      action: "submit_listing",
      entityType: "product",
      entityId: productId,
    });

    revalidatePath(`/employee/${employeeId}/listings`);
    redirect(`/employee/${employeeId}/listings`);
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// ── Update own profile (bio/avatar only) ───────────────────────────────────────
// Name, pay rate, and status are admin-controlled — not writable here.
export async function updateOwnEmployeeProfile(formData: FormData): Promise<{ error: string } | void> {
  try {
    const employeeId = await requireEmployeeId();
    const bio = String(formData.get("bio") ?? "").trim();
    const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

    const { error } = await supabaseAdmin
      .from("employee_profiles")
      .update({
        bio: bio || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", employeeId);

    if (error) throw new Error(error.message);
    revalidatePath(`/employee/${employeeId}/profile`);
    revalidatePath(`/employee/${employeeId}`);
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "Failed to save." };
  }
}
