import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { LivestreamCheckoutClient } from "./LivestreamCheckoutClient";

export const dynamic = "force-dynamic";

export default async function LivestreamCheckoutTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("status, checkout_active, checkout_expires_at, title_snapshot, code, size, price, checkout_price, buyer_handle")
    .eq("checkout_token", token)
    .maybeSingle();

  if (!item) redirect("/livestream-checkout/invalid");

  if (!item.checkout_active || item.status !== "checkout_sent") {
    redirect("/livestream-checkout/expired");
  }

  if (item.checkout_expires_at && new Date(item.checkout_expires_at) < new Date()) {
    redirect("/livestream-checkout/expired");
  }

  return (
    <LivestreamCheckoutClient
      token={token}
      item={{
        code: item.code,
        title: item.title_snapshot,
        size: item.size,
        price: item.checkout_price ?? item.price,
        buyerHandle: item.buyer_handle,
      }}
    />
  );
}
