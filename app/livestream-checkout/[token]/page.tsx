import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function LivestreamCheckoutTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("status, checkout_active, checkout_expires_at, checkout_url")
    .eq("checkout_token", token)
    .maybeSingle();

  if (!item) {
    redirect("/livestream-checkout/invalid");
  }

  if (!item.checkout_active || item.status !== "checkout_sent") {
    redirect("/livestream-checkout/expired");
  }

  if (item.checkout_expires_at && new Date(item.checkout_expires_at) < new Date()) {
    redirect("/livestream-checkout/expired");
  }

  if (!item.checkout_url) {
    redirect("/livestream-checkout/invalid");
  }

  redirect(item.checkout_url);
}
