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

  const enriched = (campaigns ?? []).map((c) => ({
    ...c,
    product_count: counts[c.id] ?? 0,
  }));

  return <CampaignsAdminClient campaigns={enriched} />;
}
