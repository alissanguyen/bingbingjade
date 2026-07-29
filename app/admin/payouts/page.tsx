export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { PayoutsClient } from "./PayoutsClient";

export default async function AdminPayoutsPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const { data: employees } = await supabaseAdmin
    .from("approved_users")
    .select("id, full_name, employee_profiles(default_rate_per_approved_listing)")
    .eq("role", "catalog_contributor")
    .order("full_name");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Payouts</h1>
        <PayoutsClient employees={(employees ?? []).map((e) => ({ id: e.id, name: e.full_name }))} />
      </div>
    </div>
  );
}
