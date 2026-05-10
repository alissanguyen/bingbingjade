import { NextRequest, NextResponse } from "next/server";
import { getActiveEventPrices } from "@/lib/active-event-prices";

// GET /api/event-prices?productIds=id1,id2,...
// Public endpoint — no auth required. Used by CartDrawer to apply current
// campaign event pricing to cart items in real time.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("productIds") ?? "";
  const productIds = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);

  if (productIds.length === 0) return NextResponse.json({});

  const priceMap = await getActiveEventPrices(productIds);

  const result: Record<
    string,
    {
      campaignEventId: string;
      explicitPrice: number | null;
      discountType: string | null;
      discountValue: number | null;
      computedBasePrice: number;
    } | null
  > = {};

  for (const id of productIds) {
    result[id] = priceMap.get(id) ?? null;
  }

  return NextResponse.json(result);
}
