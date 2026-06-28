import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import Link from "next/link";

export const metadata = { title: "Livestreams — Admin" };
export const dynamic = "force-dynamic";

export default async function LivestreamsAdminPage() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  const { data: livestreams } = await supabaseAdmin
    .from("livestreams")
    .select("*, livestream_items(status)")
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminBarServer />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Livestreams</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Instagram / TikTok live sale management</p>
            </div>
            <Link
              href="/livestreams-admin/new"
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              + New Livestream
            </Link>
          </div>

          {!livestreams?.length ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 py-16 text-center text-sm text-gray-400">
              No livestreams yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {livestreams.map((ls) => {
                const items = (ls.livestream_items as { status: string }[]) ?? [];
                const available    = items.filter((i) => i.status === "available").length;
                const checkoutSent = items.filter((i) => i.status === "checkout_sent").length;
                const paid         = items.filter((i) => i.status === "paid").length;
                const total        = items.length;

                const statusColors: Record<string, string> = {
                  draft:  "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                  live:   "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
                  ended:  "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                };

                return (
                  <div key={ls.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[ls.status] ?? statusColors.draft}`}>
                          {ls.status}
                        </span>
                        <span className="text-xs text-gray-400">{ls.platform}</span>
                        {ls.scheduled_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(ls.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">{ls.title}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {total} items · {available} available · {checkoutSent} checkout sent · {paid} paid
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ls.status === "live" && (
                        <Link
                          href={`/livestreams-admin/${ls.id}/live`}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          Live Mode
                        </Link>
                      )}
                      <Link
                        href={`/livestreams-admin/${ls.id}`}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
