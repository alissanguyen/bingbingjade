import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { getAvailableCredit } from "@/lib/sourcing-workflow";
import { AttemptManager } from "./AttemptManager";

export const dynamic = "force-dynamic";

const PAYMENT_COLORS: Record<string, string> = {
  awaiting_payment: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  paid:             "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  refunded:         "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  expired:          "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const SOURCING_COLORS: Record<string, string> = {
  queued:                    "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  in_progress:               "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  awaiting_response:         "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  responded:                 "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  accepted_pending_checkout: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  fulfilled:                 "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  cancelled:                 "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  closed:                    "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const TYPE_COLORS: Record<string, string> = {
  standard:  "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  premium:   "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  concierge: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function PrefRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default async function SourcingRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) notFound();

  const { id } = await params;

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!req) notFound();

  const { data: attempts } = await supabaseAdmin
    .from("sourcing_attempts")
    .select(`
      id, attempt_number, status,
      sent_at, response_due_at, responded_at, customer_feedback, admin_notes,
      sourcing_attempt_options (
        id, title, images_json, price_cents, tier, color, dimensions, notes,
        status, customer_reaction, customer_note, sort_order
      )
    `)
    .eq("sourcing_request_id", id)
    .order("attempt_number", { ascending: true });

  const { availableCents } = await getAvailableCredit(id);

  const prefs = (req.preferences_json ?? {}) as Record<string, unknown>;
  const refImages = (req.reference_images_json ?? []) as Array<{ type: string; value: string; originalName?: string }>;

  const sortedAttempts = (attempts ?? []).map((a) => ({
    ...a,
    sourcing_attempt_options: [...(a.sourcing_attempt_options ?? [])].sort(
      (x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0)
    ),
  }));

  return (
    <>
      <AdminBarServer />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/sourcing-admin" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            ← All Requests
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Sourcing Request
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {String(req.customer_name)}
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{String(req.customer_email)}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge
                label={String(req.payment_status)}
                colorClass={PAYMENT_COLORS[String(req.payment_status)] ?? "bg-gray-100 text-gray-500"}
              />
              <Badge
                label={String(req.sourcing_status)}
                colorClass={SOURCING_COLORS[String(req.sourcing_status)] ?? "bg-gray-100 text-gray-500"}
              />
              <Badge
                label={String(req.request_type)}
                colorClass={TYPE_COLORS[String(req.request_type)] ?? "bg-gray-100 text-gray-500"}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 text-right space-y-0.5">
            <p className="font-mono">{String(req.id)}</p>
            <p>Created {new Date(String(req.created_at)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
            {req.public_token && (
              <a
                href={`/custom-sourcing/${String(req.public_token)}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Customer link ↗
              </a>
            )}
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Category", value: String(req.category).charAt(0).toUpperCase() + String(req.category).slice(1) },
            {
              label: "Budget",
              value: `$${Number(req.budget_min)}${req.budget_max ? `–$${Number(req.budget_max)}` : "+"}`,
            },
            { label: "Deposit paid", value: `$${(Number(req.deposit_amount_cents) / 100).toFixed(2)}` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Attempt progress */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Attempts: <strong className="text-gray-800 dark:text-gray-200">{Number(req.attempts_used ?? 0)}/{Number(req.max_attempts ?? 2)}</strong></span>
          {req.credit_expires_at && (
            <span>
              Credit expires: <strong className={new Date(String(req.credit_expires_at)) < new Date() ? "text-red-500" : "text-gray-800 dark:text-gray-200"}>
                {new Date(String(req.credit_expires_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </strong>
            </span>
          )}
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preferences</h2>
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 gap-4 text-sm">
            <PrefRow label="Timeline" value={String(prefs.timeline ?? "").replace(/_/g, " ")} />
            <PrefRow label="Color preference" value={prefs.preferred_color as string} />
            <PrefRow label="Size" value={prefs.size_description as string} />
            <PrefRow label="Translucency" value={prefs.translucency_preference ? String(prefs.translucency_preference).replace(/_/g, " ") : null} />
            <PrefRow label="Exact dimensions" value={prefs.exact_dimensions as string} />
            <PrefRow label="Color detail" value={prefs.color_detail as string} />
            <PrefRow label="Pattern / veining" value={prefs.pattern_description as string} />
            <PrefRow label="Reference notes" value={prefs.reference_notes as string} />
            {!!prefs.must_haves && (
              <div className="sm:col-span-2">
                <PrefRow label="Must-haves" value={prefs.must_haves as string} />
              </div>
            )}
            {!!prefs.must_avoid && (
              <div className="sm:col-span-2">
                <PrefRow label="Must avoid" value={prefs.must_avoid as string} />
              </div>
            )}
            {!!prefs.notes && (
              <div className="sm:col-span-2">
                <PrefRow label="Additional notes" value={prefs.notes as string} />
              </div>
            )}

            {/* Strictness flags */}
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1.5">Strictness flags (score: {Number(req.strictness_score)})</p>
              <div className="flex flex-wrap gap-1.5">
                {!!prefs.close_reference_match && <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-[10px]">Photo match</span>}
                {!!prefs.exact_color_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Exact color</span>}
                {!!prefs.pattern_veining_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Pattern</span>}
                {!!prefs.translucency_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Translucency</span>}
                {!!prefs.exact_dimensions_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Exact dimensions</span>}
              </div>
            </div>
          </div>

          {/* Reference images */}
          {refImages.length > 0 && (
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">Reference images</p>
              <div className="flex flex-wrap gap-2">
                {refImages.map((img, i) => (
                  <a
                    key={i}
                    href={img.value}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[200px]"
                  >
                    {img.originalName ?? `Image ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admin Action Reference */}
        <details className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden group">
          <summary className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors list-none flex items-center justify-between">
            <span>Admin Action Guide</span>
            <span className="text-gray-300 dark:text-gray-600 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 w-36">Action</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">When available</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Sets status to</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  {
                    action: "+ New Round",
                    when: "Deposit paid · rounds remaining · no active draft or sent round",
                    status: "in_progress",
                    does: "Creates a draft round. Add options, then send when ready.",
                  },
                  {
                    action: "+ Add Option",
                    when: "Round is in draft",
                    status: "—",
                    does: "Adds a sourcing option (title, price, images, notes) to the draft. Customer won't see it until you Send.",
                  },
                  {
                    action: "Send Round N",
                    when: "Draft round has ≥ 1 option",
                    status: "awaiting_response",
                    does: "Marks options active. Emails customer with 72-hour response window. Round is now locked — options cannot be edited.",
                  },
                  {
                    action: "Resend Last Email",
                    when: "Deposit paid, any status",
                    status: "—",
                    does: "Re-sends the most recent outbound email: deposit confirmation (queued), round notification (awaiting_response), or checkout offer (accepted_pending_checkout).",
                  },
                  {
                    action: "Close Request",
                    when: "Deposit paid · not already fulfilled or closed",
                    status: "closed",
                    does: "Ends the workflow. No more rounds can be created. No refund is issued — deposit is earned sourcing fee. Refund in Stripe separately if needed.",
                  },
                ].map((row) => (
                  <tr key={row.action} className="align-top">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.action}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{row.when}</td>
                    <td className="px-4 py-2.5">
                      {row.status === "—" ? (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      ) : (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {row.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{row.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Status flow */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1.5">Status flow</p>
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                {[
                  { s: "queued", note: "deposit paid" },
                  { s: "in_progress", note: "round created" },
                  { s: "awaiting_response", note: "round sent" },
                  { s: "responded", note: "customer replied" },
                  { s: "accepted_pending_checkout", note: "option accepted" },
                  { s: "fulfilled", note: "payment received" },
                ].map((item, i) => (
                  <span key={item.s} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 dark:text-gray-700">→</span>}
                    <span className="font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{item.s}</span>
                    <span className="text-gray-400 dark:text-gray-600">({item.note})</span>
                  </span>
                ))}
                <span className="flex items-center gap-1 ml-2">
                  <span className="text-gray-300 dark:text-gray-700">or</span>
                  <span className="font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">closed</span>
                  <span className="text-gray-400 dark:text-gray-600">(admin closed)</span>
                </span>
              </div>
            </div>
          </div>
        </details>

        {/* Attempt Manager */}
        <AttemptManager
          requestId={id}
          sourcingStatus={String(req.sourcing_status)}
          paymentStatus={String(req.payment_status)}
          maxAttempts={Number(req.max_attempts ?? 2)}
          attemptsUsed={Number(req.attempts_used ?? 0)}
          publicToken={req.public_token ? String(req.public_token) : null}
          availableCreditCents={availableCents}
          initialAttempts={sortedAttempts}
        />
      </div>
    </>
  );
}
