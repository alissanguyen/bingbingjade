import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import type { Subscriber } from "./SubscribersAdminClient";
import { SubscribersAdminClient } from "./SubscribersAdminClient";

export const dynamic = "force-dynamic";

export default async function SubscribersAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const { data } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, email, subscribed_at, welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at, source, used_fingerprint")
    .order("subscribed_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <SubscribersAdminClient subscribers={(data ?? []) as Subscriber[]} />
    </div>
  );
}
