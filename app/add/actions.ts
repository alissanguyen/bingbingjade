"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify, generatePublicId } from "@/lib/slug";
import { getSessionUser, isAdmin, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";
import type { ProductCategory } from "@/types/product";

interface OptionInput {
  label: string;
  size: string;
  price: string;
  salePrice?: string;
  comboOf?: number[];
  status: string;
  image_index?: number | null;
}

export async function createProduct(formData: FormData): Promise<{ error?: string; success?: boolean; pendingApproval?: boolean }> {
  const session = await getSessionUser();
  const adminUser = isAdmin(session);
  const approvedUser = isApproved(session);
  const approvedUserId = approvedUser
    ? (session as Extract<SessionUser, { type: "approved" }>).user.id
    : null;

  const imageUrls = formData.getAll("imageUrls") as string[];
  const videoUrls = formData.getAll("videoUrls") as string[];

  const vendor_id = formData.get("vendor_id") as string;
  if (!vendor_id) return { error: "Please select a vendor before saving." };

  const name = formData.get("name") as string;
  const productStatus = (formData.get("status") as string) || "available";

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({
      name,
      slug: slugify(name),
      public_id: generatePublicId(),
      category: formData.get("category") as ProductCategory,
      origin: (formData.get("origin") as string) || "Myanmar",
      color: formData.getAll("color") as string[],
      tier: formData.getAll("tier") as string[],
      size: Number(formData.get("size")),
      size_detailed: (() => {
        const vals = ["size_detailed_0", "size_detailed_1", "size_detailed_2"].map(k => {
          const v = formData.get(k); return v !== "" && v !== null ? Number(v) : null;
        });
        return vals.some(v => v !== null) ? vals : null;
      })(),
      description: (formData.get("description") as string) || null,
      blemishes: (formData.get("blemishes") as string) || null,
      price_display_usd: formData.get("price_display_usd") ? Number(formData.get("price_display_usd")) : null,
      sale_price_usd: formData.get("sale_price_usd") ? Number(formData.get("sale_price_usd")) : null,
      imported_price_vnd: approvedUser ? 0 : Number(formData.get("imported_price_vnd")),
      vendor_id,
      is_featured: formData.get("is_featured") === "true",
      // Admin: respect the published toggle. Approved user: always draft + pending approval.
      is_published: adminUser ? formData.get("is_published") === "true" : false,
      show_price: formData.get("show_price") === "true",
      pending_approval: approvedUser,
      created_by: approvedUser ? approvedCreatedBy(approvedUserId!) : "admin",
      quick_ship: formData.get("quick_ship") === "true",
      status: productStatus,
      images: imageUrls,
      videos: videoUrls,
      sku: (formData.get("sku") as string) || null,
      // Track when first published for auto-archive
      published_at: adminUser && formData.get("is_published") === "true" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Record SKU → vendor mapping in product_originals (non-fatal)
  const sku = (formData.get("sku") as string) || null;
  if (sku && vendor_id) {
    const { data: vendorRow } = await supabaseAdmin
      .from("vendors")
      .select("name")
      .eq("id", vendor_id)
      .single();
    await supabaseAdmin.from("product_originals").upsert({
      sku,
      vendor_id,
      vendor_name: vendorRow?.name ?? "",
    }, { onConflict: "sku" });
  }

  // Bust the products listing cache so a newly published product appears immediately
  if (adminUser && formData.get("is_published") === "true") {
    revalidatePath("/products");
  }

  // Insert product options
  const optionsJson = formData.get("options_json") as string | null;
  if (optionsJson && data?.id) {
    try {
      const parsedOptions = JSON.parse(optionsJson) as OptionInput[];
      const isSingleNoLabel = parsedOptions.length === 1 && !parsedOptions[0].label;
      const optionsToInsert = parsedOptions.map((o, i) => ({
        product_id: data.id,
        label: o.label || null,
        size: o.size ? Number(o.size) : null,
        price_usd: o.price ? Number(o.price) : null,
        sale_price_usd: o.salePrice ? Number(o.salePrice) : null,
        image_index: o.image_index ?? null,
        status: isSingleNoLabel
          ? (productStatus === "sold" ? "sold" : "available")
          : (o.status || "available"),
        sort_order: i,
      }));
      const { data: inserted, error: insertError } = await supabaseAdmin.from("product_options").insert(optionsToInsert).select("id");
      if (insertError) throw new Error(`Variants save failed: ${insertError.message}`);
      if (inserted) {
        for (let i = 0; i < parsedOptions.length; i++) {
          const indices = parsedOptions[i].comboOf;
          if (!indices?.length) continue;
          const resolvedIds = indices
            .filter((idx) => idx >= 0 && idx < inserted.length && idx !== i)
            .map((idx) => inserted[idx].id);
          if (resolvedIds.length > 0) {
            await supabaseAdmin.from("product_options").update({ combo_of: resolvedIds }).eq("id", inserted[i].id);
          }
        }
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to save variants" };
    }
  }

  return { success: true, ...(approvedUser ? { pendingApproval: true } : {}) };
}
