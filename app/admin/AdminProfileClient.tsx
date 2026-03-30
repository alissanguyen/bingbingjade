"use client";

import { useState } from "react";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PendingProduct = {
  id: string;
  name: string;
  category: string;
  isEdit: boolean;
  submitterName: string;
  thumbnailUrl: string | null;
};

export type TokenRequestItem = {
  id: string;
  userName: string;
  userEmail: string;
  message: string | null;
  requested_amount: number;
  current_tokens: number;
  created_at: string;
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

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminProfileClient({
  pendingProducts: initialPending,
  tokenRequests: initialRequests,
}: {
  pendingProducts: PendingProduct[];
  tokenRequests: TokenRequestItem[];
}) {
  const [tokenRequests, setTokenRequests] = useState(initialRequests);
  const [pendingProducts] = useState(initialPending);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleTokenRequest(
    id: string,
    action: "approve" | "deny",
    grantedAmount?: number,
    adminNote?: string
  ) {
    const res = await fetch(`/api/admin/token-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, granted_amount: grantedAmount, admin_note: adminNote }),
    });
    if (res.ok) {
      setTokenRequests((prev) => prev.filter((r) => r.id !== id));
      showToast(action === "approve" ? "Tokens granted." : "Request denied.");
    } else {
      const data = await res.json();
      showToast(data.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Token Requests */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Token Requests
          {tokenRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs font-bold">
              {tokenRequests.length}
            </span>
          )}
        </h2>

        {tokenRequests.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No pending token requests.</p>
        ) : (
          <ul className="space-y-3">
            {tokenRequests.map((r) => (
              <TokenRequestRow
                key={r.id}
                request={r}
                onApprove={(grantedAmount, note) =>
                  handleTokenRequest(r.id, "approve", grantedAmount, note)
                }
                onDeny={(note) => handleTokenRequest(r.id, "deny", undefined, note)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Pending Product Approvals */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Pending Product Approvals
          {pendingProducts.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold">
              {pendingProducts.length}
            </span>
          )}
        </h2>

        {pendingProducts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No pending product approvals.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Review these in the{" "}
              <a href="/products-admin" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                Products admin
              </a>{" "}
              page.
            </p>
            <ul className="space-y-3">
              {pendingProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
                >
                  <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {p.thumbnailUrl ? (
                      <Image
                        src={p.thumbnailUrl}
                        alt={p.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {CAT_LABEL[p.category] ?? p.category} ·{" "}
                      {p.isEdit ? "Edit proposed" : "New listing"} · by {p.submitterName}
                    </p>
                  </div>
                  <a
                    href="/products-admin"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex-shrink-0"
                  >
                    Review →
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

// ── Token request row with inline approve / deny ───────────────────────────────

function TokenRequestRow({
  request,
  onApprove,
  onDeny,
}: {
  request: TokenRequestItem;
  onApprove: (grantedAmount: number, note: string) => void;
  onDeny: (note: string) => void;
}) {
  const [grantAmount, setGrantAmount] = useState(String(request.requested_amount));
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handle(action: "approve" | "deny") {
    setLoading(true);
    if (action === "approve") {
      await onApprove(Math.max(Number(grantAmount) || request.requested_amount, 1), note);
    } else {
      await onDeny(note);
    }
    setLoading(false);
  }

  return (
    <li className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {request.userName}
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">{request.userEmail}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Requesting {request.requested_amount} tokens · currently has {request.current_tokens} · {fmt(request.created_at)}
          </p>
          {request.message && (
            <p className="text-xs text-gray-600 dark:text-gray-300 italic">&ldquo;{request.message}&rdquo;</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
        >
          {expanded ? "Cancel" : "Respond"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Grant amount</label>
            <input
              type="number"
              min={1}
              max={500}
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              className="w-20 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <input
            type="text"
            placeholder="Admin note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handle("approve")}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handle("deny")}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : "Deny"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
