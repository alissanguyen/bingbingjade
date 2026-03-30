import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { resolveFirstImageUrl } from "@/lib/storage";
import type { PendingProduct, TokenRequestItem } from "./AdminProfileClient";
import { AdminProfileClient } from "./AdminProfileClient";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const [{ data: pendingRows }, { data: tokenRequestRows }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, images, pending_data, created_by")
      .eq("pending_approval", true)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("token_requests")
      .select("id, message, requested_amount, created_at, user_id, approved_users(id, full_name, email, generation_tokens)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  // Resolve approved-user names for pending products
  const approvedIds = [...new Set(
    (pendingRows ?? [])
      .map((p) => p.created_by?.startsWith("approved:") ? p.created_by.replace("approved:", "") : null)
      .filter(Boolean) as string[]
  )];
  const nameMap: Record<string, string> = {};
  if (approvedIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("approved_users")
      .select("id, full_name")
      .in("id", approvedIds);
    (users ?? []).forEach((u) => { nameMap[u.id] = u.full_name; });
  }

  const pendingProducts: PendingProduct[] = await Promise.all(
    (pendingRows ?? []).map(async (p) => {
      const uid = p.created_by?.startsWith("approved:") ? p.created_by.replace("approved:", "") : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        isEdit: p.pending_data !== null,
        submitterName: uid ? (nameMap[uid] ?? "Partner") : "Admin",
        thumbnailUrl: await resolveFirstImageUrl(p.images ?? []),
      };
    })
  );

  const tokenRequests: TokenRequestItem[] = (tokenRequestRows ?? []).map((r) => {
    const u = Array.isArray(r.approved_users) ? r.approved_users[0] : r.approved_users;
    return {
      id: r.id,
      userName: u?.full_name ?? "Unknown",
      userEmail: u?.email ?? "",
      message: r.message,
      requested_amount: r.requested_amount,
      current_tokens: u?.generation_tokens ?? 0,
      created_at: r.created_at,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin Profile</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Pending action items</p>
      </div>
      <AdminProfileClient
        pendingProducts={pendingProducts}
        tokenRequests={tokenRequests}
      />
    </div>
  );
}
