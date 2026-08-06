export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { TokenSection } from "@/app/components/TokenSection";

type TokenRequest = {
  id: string;
  requested_amount: number;
  status: "pending" | "approved" | "denied";
  granted_amount: number | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

// Ownership/auth for this whole /employee/[employeeId]/** subtree is already
// enforced by app/employee/[employeeId]/layout.tsx — no re-check needed here
// (same pattern as the sibling profile page).
export default async function EmployeeTokensPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const [{ data: userRow }, { data: tokenRequests }] = await Promise.all([
    supabaseAdmin.from("approved_users").select("generation_tokens").eq("id", employeeId).single(),
    supabaseAdmin
      .from("token_requests")
      .select("id, requested_amount, status, granted_amount, admin_note, created_at, resolved_at")
      .eq("user_id", employeeId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Tokens</h1>
      <TokenSection
        tokens={userRow?.generation_tokens ?? 0}
        requests={(tokenRequests ?? []) as TokenRequest[]}
      />
    </div>
  );
}
