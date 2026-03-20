"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify, generatePublicId } from "@/lib/slug";
import type { ProductCategory } from "@/types/product";

interface OptionInput {
  label: string;
  size: string;
  price: string;
  status: string;
  images?: string[];
}

export async function createProduct(formData: FormData): Promise<{ error?: string; success?: boolean }> {
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
      imported_price_vnd: Number(formData.get("imported_price_vnd")),
      vendor_id,
      is_featured: formData.get("is_featured") === "true",
      status: productStatus,
      images: imageUrls,
      videos: videoUrls,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

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
        images: o.images ?? [],
        status: isSingleNoLabel
          ? (productStatus === "sold" ? "sold" : "available")
          : (o.status || "available"),
        sort_order: i,
      }));
      await supabaseAdmin.from("product_options").insert(optionsToInsert);
    } catch {
      // options_json parse failure is non-fatal
    }
  }

  return { success: true };
}
