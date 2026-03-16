"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ProductCategory } from "@/types/product";

export async function updateProduct(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const imageUrls = formData.getAll("imageUrls") as string[];
  const videoUrls = formData.getAll("videoUrls") as string[];

  const { error } = await supabaseAdmin
    .from("products")
    .update({
      name: formData.get("name") as string,
      category: formData.get("category") as ProductCategory,
      color: formData.getAll("color") as string[],
      tier: formData.get("tier") as string,
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
      status: (formData.get("status") as string) || "available",
      images: imageUrls,
      videos: videoUrls,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
