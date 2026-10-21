import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batch_id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const certificate_id = (body.certificate_id as string | undefined)?.trim();
  if (!certificate_id) return NextResponse.json({ error: "certificate_id is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("inventory_batch_items")
    .insert({
      batch_id,
      product_id:                   body.product_id || null,
      assigned_inventory_cost_usd:  Number(body.assigned_inventory_cost_usd ?? 0),
      item_expense_usd:             Number(body.item_expense_usd ?? 0),
      allocation_method:            body.allocation_method || "manual",
      notes:                        (body.notes as string | undefined)?.trim() || null,
      certificate_id,
    })
    .select("id, product_id, assigned_inventory_cost_usd, item_expense_usd, allocation_method, notes, certificate_id, created_at, products(id, name, public_id, sku, slug, images, price_display_usd, sale_price_usd)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = Array.isArray((data as any).products) ? (data as any).products[0] : (data as any).products;
  const productImageUrl = product?.images ? await resolveFirstImageUrl(product.images as string[]) : null;
  return NextResponse.json({
    item: {
      ...data,
      productName:      product?.name ?? null,
      productPublicId:  product?.public_id ?? null,
      productSku:       product?.sku ?? null,
      productSlug:      product?.slug ?? null,
      productImageUrl,
      listPriceUsd:     product?.price_display_usd != null ? Number(product.price_display_usd) : null,
      salePriceUsd:     product?.sale_price_usd != null ? Number(product.sale_price_usd) : null,
      isSold:           false,
    },
  }, { status: 201 });
}
