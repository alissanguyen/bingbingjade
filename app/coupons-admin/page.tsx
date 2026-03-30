import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import type { Campaign } from "./CouponsAdminClient";
import { CouponsAdminClient } from "./CouponsAdminClient";

export const dynamic = "force-dynamic";

export default async function CouponsAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const { data: campaigns } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const ids = (campaigns ?? []).map((c) => c.id);
  const counts: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: redemptions } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("campaign_id")
      .in("campaign_id", ids)
      .neq("status", "cancelled");

    (redemptions ?? []).forEach((r: { campaign_id: string }) => {
      counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1;
    });
  }

  const data: Campaign[] = (campaigns ?? []).map((c) => ({
    ...c,
    redemption_count: counts[c.id] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <CouponsAdminClient campaigns={data} />
    </div>
  );
}
