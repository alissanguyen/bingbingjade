"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { toStoragePath } from "@/lib/storage";
import type { ProductCategory } from "@/types/product";

interface OptionInput {
  label: string;
  size: string;
  price: string;
  status: string;
  images?: string[];
}

export async function deleteProduct(id: string): Promise<{ error?: string; success?: boolean }> {
  const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const imageUrls = (formData.getAll("imageUrls") as string[]).map(toStoragePath);
  const videoUrls = (formData.getAll("videoUrls") as string[]).map(toStoragePath);
  const productStatus = (formData.get("status") as string) || "available";

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
      imported_price_vnd: Number(formData.get("imported_price_vnd")),
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

  // Replace options: delete all existing, then reinsert
  const optionsJson = formData.get("options_json") as string | null;
  if (optionsJson) {
    try {
      const parsedOptions = JSON.parse(optionsJson) as OptionInput[];
      const isSingleNoLabel = parsedOptions.length === 1 && !parsedOptions[0].label;
      await supabaseAdmin.from("product_options").delete().eq("product_id", id);
      const optionsToInsert = parsedOptions.map((o, i) => ({
        product_id: id,
        label: o.label || null,
        size: o.size ? Number(o.size) : null,
        price_usd: o.price ? Number(o.price) : null,
        images: o.images ?? [],
        status: isSingleNoLabel
          ? (productStatus === "sold" ? "sold" : "available")
          : (o.status || "available"),
        sort_order: i,
      }));
      await supabaseAdmin.from("product_options").insert(optionsToInsert);

      // Auto-mark product sold if all options are now sold
      const allOptionsSold =
        optionsToInsert.length > 0 && optionsToInsert.every((o) => o.status === "sold");
      if (allOptionsSold && productStatus !== "sold") {
        await supabaseAdmin
          .from("products")
          .update({ status: "sold" })
          .eq("id", id);
      }
    } catch {
      // options_json parse failure is non-fatal
    }
  }

  return { success: true };
}
