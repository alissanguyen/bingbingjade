export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { CampaignsAdminClient } from "./CampaignsAdminClient";

export default async function CampaignsAdminPage() {
  const { data: campaigns } = await supabaseAdmin
    .from("campaign_events")
    .select("*")
    .order("created_at", { ascending: false });

  // Product counts
  const ids = (campaigns ?? []).map((c) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("campaign_event_products")
      .select("campaign_id")
      .in("campaign_id", ids);
    (rows ?? []).forEach((r: { campaign_id: string }) => {
      counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1;
    });
  }

  // Auto-expire: any "active" campaign whose ends_at is in the past → set to "ended"
  const now = new Date().toISOString();
  const toExpire = (campaigns ?? []).filter(
    (c) => c.status === "active" && c.ends_at && c.ends_at < now
  );
  if (toExpire.length > 0) {
    await supabaseAdmin
      .from("campaign_events")
      .update({ status: "ended" })
      .in("id", toExpire.map((c) => c.id));
  }

  const expiredIds = new Set(toExpire.map((c) => c.id));
  const enriched = (campaigns ?? []).map((c) => ({
    ...c,
    status: expiredIds.has(c.id) ? "ended" : c.status,
    product_count: counts[c.id] ?? 0,
  }));

  return <CampaignsAdminClient campaigns={enriched} />;
}
