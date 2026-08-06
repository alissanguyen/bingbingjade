"use client";

import { useState } from "react";

type TokenRequest = {
  id: string;
  requested_amount: number;
  status: "pending" | "approved" | "denied";
  granted_amount: number | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TokenSection({
  tokens,
  requests,
}: {
  tokens: number;
  requests: TokenRequest[];
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [localRequests, setLocalRequests] = useState(requests);

  const hasPending = localRequests.some((r) => r.status === "pending");

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/approved/token-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? "Something went wrong." });
      } else {
        setResult({ ok: true });
        setMessage("");
        // Optimistically add a pending row
        setLocalRequests((prev) => [
          {
            id: crypto.randomUUID(),
            requested_amount: 10,
            status: "pending",
            granted_amount: null,
            admin_note: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
          },
          ...prev,
        ]);
      }
    } catch {
      setResult({ error: "Network error." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      {/* Balance */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Generation Tokens
        </h2>
        <span
          className={`text-sm font-semibold px-3 py-1 rounded-full ${
            tokens === 0
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
              : tokens <= 3
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          }`}
        >
          {tokens} remaining
        </span>
      </div>

      {tokens === 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">
          You have no tokens left. Each &ldquo;Generate Copy&rdquo; click uses one token. Request more below.
        </p>
      )}

      {/* Request form */}
      {!hasPending ? (
        <form onSubmit={handleRequest} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Need more tokens? Send a request to admin.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional note (e.g. working on a large batch of listings)"
            rows={2}
            className="w-full text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          {result?.error && <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>}
          {result?.ok && <p className="text-xs text-emerald-600 dark:text-emerald-400">Request sent!</p>}
          <button
            type="submit"
            disabled={submitting}
            className="text-xs font-medium px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
          >
            {submitting ? "Sending…" : "Request tokens"}
          </button>
        </form>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          You have a pending token request — waiting for admin to respond.
        </div>
      )}

      {/* History */}
      {localRequests.length > 0 && (
        <ul className="space-y-2">
          {localRequests.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 text-xs"
            >
              <div className="space-y-0.5">
                <span className="text-gray-700 dark:text-gray-300">
                  Requested {r.requested_amount} tokens
                  {r.granted_amount !== null && r.granted_amount !== r.requested_amount
                    ? ` · Granted ${r.granted_amount}`
                    : ""}
                </span>
                {r.admin_note && (
                  <p className="text-gray-500 dark:text-gray-400 italic">&ldquo;{r.admin_note}&rdquo;</p>
                )}
                <p className="text-gray-400 dark:text-gray-500">{fmt(r.created_at)}</p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs">Pending</span>;
  if (status === "approved")
    return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">Approved</span>;
  return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs">Denied</span>;
}
