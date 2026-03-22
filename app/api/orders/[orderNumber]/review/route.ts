import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;

  const body = await req.json().catch(() => null);
  const rating = body?.rating;
  const description = body?.description ?? null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "Rating must be an integer between 1 and 10." }, { status: 400 });
  }

  // Fetch the order — must be delivered before accepting a review
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, order_status, customer_id, customer_name, created_at")
    .eq("order_number", orderNumber.toUpperCase())
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.order_status !== "delivered") {
    return NextResponse.json({ error: "Reviews can only be submitted for delivered orders." }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A review for this order already exists." }, { status: 409 });
  }

  const { data: review, error: insertErr } = await supabaseAdmin
    .from("reviews")
    .insert({
      order_id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id ?? null,
      customer_name: order.customer_name ?? "Anonymous",
      rating,
      description: description || null,
      date_purchased: order.created_at,
    })
    .select("id, rating, description, date_rated")
    .single();

  if (insertErr || !review) {
    console.error("[review] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }

  return NextResponse.json({ review }, { status: 201 });
}
