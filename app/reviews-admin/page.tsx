import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
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
  images: { id: string; image_path: string; image_url: string; sort_order: number }[];
};

export default async function ReviewsAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/");

  const { data: rows } = await supabaseAdmin
    .from("reviews")
    .select(`
      id, order_number, customer_name, rating, description,
      date_purchased, date_rated, is_approved, created_at,
      review_images ( id, image_path, sort_order )
    `)
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
    images: ((r.review_images as { id: string; image_path: string; sort_order: number }[]) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        id: img.id,
        image_path: img.image_path,
        image_url: reviewImagePublicUrl(img.image_path),
        sort_order: img.sort_order,
      })),
  }));

  return <ReviewsAdminClient reviews={reviews} />;
}
