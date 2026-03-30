import { redirect } from "next/navigation";
import { getSessionUser, isApproved } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import Image from "next/image";
import { TokenSection } from "./TokenSection";

// ── Types ──────────────────────────────────────────────────────────────────────

type Submission = {
  id: string;
  name: string;
  category: string;
  images: string[];
  pending_approval: boolean;
  pending_data: Record<string, unknown> | null;
  rejected_at: string | null;
  rejection_note: string | null;
  created_at: string;
};

type TokenRequest = {
  id: string;
  requested_amount: number;
  status: "pending" | "approved" | "denied";
  granted_amount: number | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

const CAT_LABEL: Record<string, string> = {
  bracelet: "Bracelet",
  bangle: "Bangle",
  ring: "Ring",
  pendant: "Pendant",
  necklace: "Necklace",
  other: "Other",
  custom_order: "Custom Order",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!isApproved(session)) redirect("/approved-login");

  const user = (session as Extract<typeof session, { type: "approved" }>)!.user;
  const createdBy = `approved:${user.id}`;

  const [{ data: submissions }, { data: userRow }, { data: tokenRequests }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, images, pending_approval, pending_data, rejected_at, rejection_note, created_at")
      .eq("created_by", createdBy)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("approved_users")
      .select("generation_tokens")
      .eq("id", user.id)
      .single(),
    supabaseAdmin
      .from("token_requests")
      .select("id, requested_amount, status, granted_amount, admin_note, created_at, resolved_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const rows = (submissions ?? []) as Submission[];
  const pending = rows.filter((r) => r.pending_approval);
  const rejected = rows.filter((r) => !r.pending_approval && r.rejected_at !== null);
  const generationTokens = userRow?.generation_tokens ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{user.full_name}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>

        {/* Tokens */}
        <TokenSection
          tokens={generationTokens}
          requests={(tokenRequests ?? []) as TokenRequest[]}
        />

        {/* Pending */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold">
                {pending.length}
              </span>
            )}
          </h2>

          {pending.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No items pending review.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <SubmissionRow
                  key={item.id}
                  item={item}
                  badge={
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      Awaiting review
                    </span>
                  }
                  sub={`Submitted ${fmt(item.created_at)}${item.pending_data ? " · Edit proposed" : " · New listing"}`}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Rejected */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Rejected
          </h2>

          {rejected.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No rejected submissions.</p>
          ) : (
            <ul className="space-y-3">
              {rejected.map((item) => (
                <SubmissionRow
                  key={item.id}
                  item={item}
                  badge={
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                      Dismissed
                    </span>
                  }
                  sub={`Dismissed ${fmt(item.rejected_at!)}`}
                  note={item.rejection_note ?? undefined}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Tasks — placeholder */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Tasks
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">No tasks assigned.</p>
        </section>
      </div>
    </div>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────────

function SubmissionRow({
  item,
  badge,
  sub,
  note,
}: {
  item: Submission;
  badge: React.ReactNode;
  sub: string;
  note?: string;
}) {
  const thumb = item.images?.[0] ?? null;

  return (
    <li className="flex items-start gap-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      {/* Thumbnail */}
      <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
        {thumb ? (
          <Image src={thumb} alt={item.name} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs">
            No img
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {CAT_LABEL[item.category] ?? item.category} · {sub}
        </p>
        {note && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 italic">&ldquo;{note}&rdquo;</p>
        )}
      </div>
    </li>
  );
}
