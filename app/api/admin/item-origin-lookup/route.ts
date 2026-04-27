/**
 * GET /api/admin/item-origin-lookup?sku=00012345
 *
 * Returns all original (unwatermarked) images for a product listing,
 * identified by its 8-digit SKU. Vendor info comes from product_originals.
 *
 * Auth: requires admin_session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { IMAGE_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = req.nextUrl.searchParams.get("sku")?.trim();
  if (!sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const paddedSku = sku.padStart(8, "0");

  // Vendor info from product_originals (SKU → vendor snapshot)
  const { data: original } = await supabaseAdmin
    .from("product_originals")
    .select("vendor_id, vendor_name, vendors(platform, contact)")
    .eq("sku", paddedSku)
    .single();

  // All original images for this SKU
  const { data: images, error: imgErr } = await supabaseAdmin
    .from("product_original_images")
    .select("id, original_storage_path, uploaded_at")
    .eq("sku", paddedSku)
    .order("uploaded_at");

  if (imgErr) {
    return NextResponse.json({ error: imgErr.message }, { status: 500 });
  }
  if (!images || images.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Product metadata
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, name, public_id, category, created_at")
    .eq("sku", paddedSku)
    .single();

  // Signed URLs for each original image (valid 1 hour)
  const signedImages = await Promise.all(
    images.map(async (img) => {
      const { data } = await supabaseAdmin.storage
        .from(IMAGE_BUCKET)
        .createSignedUrl(img.original_storage_path, 3600);
      return {
        id: img.id,
        storage_path: img.original_storage_path,
        signed_url: data?.signedUrl ?? null,
        uploaded_at: img.uploaded_at,
      };
    })
  );

  const vendor = original
    ? {
        id: original.vendor_id ?? null,
        name: original.vendor_name || null,
        platform: (original.vendors as { platform?: string; contact?: string } | null)?.platform ?? null,
        contact: (original.vendors as { platform?: string; contact?: string } | null)?.contact ?? null,
      }
    : null;

  return NextResponse.json({
    sku: paddedSku,
    images: signedImages,
    vendor,
    product: product ?? null,
  });
}
