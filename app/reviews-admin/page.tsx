import { supabaseAdmin } from "@/lib/supabase-admin";
import { ReviewsAdminClient } from "./ReviewsAdminClient";
import { reviewImagePublicUrl } from "@/lib/storage";

export const revalidate = 0;

export type AdminReview = {
  id: string;
  order_number: string;
  customer_name: string;
  rating: number;
  description: string | null;
  date_purchased: string;
  date_rated: string;
  is_approved: boolean;
  created_at: string;
  image_path: string | null;
  image_url: string | null;
};

export default async function ReviewsAdminPage() {
  const { data: rows } = await supabaseAdmin
    .from("reviews")
    .select("id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved, created_at, image_path")
    .order("is_approved", { ascending: true })   // pending (false) first
    .order("created_at", { ascending: false });

  const reviews: AdminReview[] = (rows ?? []).map((r) => ({
    id: r.id,
    order_number: r.order_number,
    customer_name: r.customer_name,
    rating: r.rating,
    description: r.description,
    date_purchased: r.date_purchased,
    date_rated: r.date_rated,
    is_approved: r.is_approved,
    created_at: r.created_at,
    image_path: r.image_path ?? null,
    image_url: r.image_path ? reviewImagePublicUrl(r.image_path) : null,
  }));

  return <ReviewsAdminClient reviews={reviews} />;
}
