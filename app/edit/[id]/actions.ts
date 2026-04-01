"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { toStoragePath } from "@/lib/storage";
import { getSessionUser, isApproved } from "@/lib/approved-auth";
import type { ProductCategory } from "@/types/product";

interface OptionInput {
  label: string;
  size: string;
  price: string;
  salePrice?: string;
  comboOf?: number[]; // sort_order indices; resolved to UUIDs after insert
  status: string;
  images?: string[];
}

export async function deleteProduct(id: string): Promise<{ error?: string; success?: boolean }> {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

/** Apply options from a JSON string — shared by admin update and approve-edit flow. */
async function applyOptions(productId: string, optionsJson: string, productStatus: string) {
  const parsedOptions = JSON.parse(optionsJson) as OptionInput[];
  const isSingleNoLabel = parsedOptions.length === 1 && !parsedOptions[0].label;
  await supabaseAdmin.from("product_options").delete().eq("product_id", productId);
  const optionsToInsert = parsedOptions.map((o, i) => ({
    product_id: productId,
    label: o.label || null,
    size: o.size ? Number(o.size) : null,
    price_usd: o.price ? Number(o.price) : null,
    sale_price_usd: o.salePrice ? Number(o.salePrice) : null,
    images: o.images ?? [],
    status: isSingleNoLabel
      ? (productStatus === "sold" ? "sold" : "available")
      : (o.status || "available"),
    sort_order: i,
  }));

  const { data: inserted } = await supabaseAdmin
    .from("product_options")
    .insert(optionsToInsert)
    .select("id");

  // Resolve comboOf sort_order indices → inserted UUIDs
  if (inserted) {
    for (let i = 0; i < parsedOptions.length; i++) {
      const indices = parsedOptions[i].comboOf;
      if (!indices?.length) continue;
      const resolvedIds = indices
        .filter((idx) => idx >= 0 && idx < inserted.length && idx !== i)
        .map((idx) => inserted[idx].id);
      if (resolvedIds.length > 0) {
        await supabaseAdmin
          .from("product_options")
          .update({ combo_of: resolvedIds })
          .eq("id", inserted[i].id);
      }
    }
  }

  const allSold = optionsToInsert.length > 0 && optionsToInsert.every((o) => o.status === "sold");
  if (allSold && productStatus !== "sold") {
    await supabaseAdmin.from("products").update({ status: "sold" }).eq("id", productId);
  }
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean; pendingApproval?: boolean }> {
  const session = await getSessionUser();
  const approvedUser = isApproved(session);

  const imageUrls = (formData.getAll("imageUrls") as string[]).map(toStoragePath);
  const videoUrls = (formData.getAll("videoUrls") as string[]).map(toStoragePath);
  const productStatus = (formData.get("status") as string) || "available";

  // ── Approved user path ──────────────────────────────────────────────────────
  if (approvedUser) {
    // Check if this is a new (unreviewed) product they created, or an existing one
    const { data: current } = await supabaseAdmin
      .from("products")
      .select("pending_approval, pending_data")
      .eq("id", id)
      .single();

    const isNewPending = current?.pending_approval === true && current?.pending_data === null;

    if (isNewPending) {
      // Their own new listing still pending — update live columns directly, keep flag set
      const { error } = await supabaseAdmin
        .from("products")
        .update({
          name: formData.get("name") as string,
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
          vendor_id: formData.get("vendor_id") as string,
          is_featured: formData.get("is_featured") === "true",
          is_published: false,
          quick_ship: formData.get("quick_ship") === "true",
          status: productStatus,
          images: imageUrls,
          videos: videoUrls,
          pending_approval: true,
        })
        .eq("id", id);
      if (error) return { error: error.message };
      const optionsJson = formData.get("options_json") as string | null;
      if (optionsJson) {
        try { await applyOptions(id, optionsJson, productStatus); } catch { /* non-fatal */ }
      }
    } else {
      // Editing an existing (live) product — store proposed changes in pending_data
      const pendingData = {
        name: formData.get("name"),
        category: formData.get("category"),
        origin: (formData.get("origin") as string) || "Myanmar",
        color: formData.getAll("color"),
        tier: formData.getAll("tier"),
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
        vendor_id: formData.get("vendor_id"),
        is_featured: formData.get("is_featured") === "true",
        is_published: false,
        quick_ship: formData.get("quick_ship") === "true",
        status: productStatus,
        images: imageUrls,
        videos: videoUrls,
        options_json: formData.get("options_json") ?? null,
      };
      const { error } = await supabaseAdmin
        .from("products")
        .update({ pending_approval: true, pending_data: pendingData })
        .eq("id", id);
      if (error) return { error: error.message };
    }

    return { success: true, pendingApproval: true };
  }

  // ── Admin path — update live columns directly ───────────────────────────────
  const { error } = await supabaseAdmin
    .from("products")
    .update({
      name: formData.get("name") as string,
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
      ...(!approvedUser && formData.has("imported_price_vnd") ? { imported_price_vnd: Number(formData.get("imported_price_vnd")) } : {}),
      vendor_id: formData.get("vendor_id") as string,
      is_featured: formData.get("is_featured") === "true",
      is_published: formData.get("is_published") === "true",
      quick_ship: formData.get("quick_ship") === "true",
      status: productStatus,
      images: imageUrls,
      videos: videoUrls,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  const optionsJson = formData.get("options_json") as string | null;
  if (optionsJson) {
    try { await applyOptions(id, optionsJson, productStatus); } catch { /* non-fatal */ }
  }

  return { success: true };
}
