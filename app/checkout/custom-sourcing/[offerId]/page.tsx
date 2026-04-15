import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SourcingCheckoutClient } from "./SourcingCheckoutClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete Your Purchase — BingBing Jade",
  robots: { index: false },
};

export default async function SourcingCheckoutPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;

  const { data: offer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, public_token, status, expires_at, title_snapshot, images_snapshot_json, price_cents, sourcing_credit_applied_cents, customer_email, sourcing_request_id")
    .eq("public_token", offerId)
    .maybeSingle();

  if (!offer) notFound();

  if (offer.status !== "pending_checkout") notFound();

  if (offer.expires_at && new Date(offer.expires_at as string) < new Date()) notFound();

  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("public_token")
    .eq("id", offer.sourcing_request_id)
    .maybeSingle();

  const sourcingToken = sourcingReq?.public_token ?? "";

  return (
    <SourcingCheckoutClient
      offerToken={offer.public_token as string}
      sourcingToken={sourcingToken}
      title={offer.title_snapshot as string}
      images={(offer.images_snapshot_json ?? []) as string[]}
      priceCents={offer.price_cents as number}
      creditAppliedCents={(offer.sourcing_credit_applied_cents ?? 0) as number}
      customerEmail={offer.customer_email as string}
      expiresAt={offer.expires_at as string | null}
    />
  );
}
