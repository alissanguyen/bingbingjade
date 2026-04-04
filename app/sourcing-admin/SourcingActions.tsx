"use client";

import { useState } from "react";

interface SourcingActionsProps {
  id: string;
  sourcingStatus: string;
  paymentStatus: string;
  creditExpiresAt: string | null;
  lastAttemptSentAt: string | null;
  finalAttemptSentAt: string | null;
  privateCheckoutUrl: string | null;
  acceptedCheckoutExpiresAt: string | null;
  availableCredit: number;
}

function Btn({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className ?? "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
    >
      {children}
    </button>
  );
}

export function SourcingActions({
  id,
  sourcingStatus,
  paymentStatus,
  creditExpiresAt,
  lastAttemptSentAt,
  finalAttemptSentAt,
  privateCheckoutUrl,
  acceptedCheckoutExpiresAt,
  availableCredit,
}: SourcingActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemPriceUsd, setItemPriceUsd] = useState("");
  const [copied, setCopied] = useState(false);

  if (paymentStatus !== "paid") return null;
  if (sourcingStatus === "fulfilled" || sourcingStatus === "cancelled") return null;

  const creditExpired = creditExpiresAt ? new Date(creditExpiresAt) < new Date() : false;
  if (creditExpired) return null;

  const checkoutExpired = acceptedCheckoutExpiresAt
    ? new Date(acceptedCheckoutExpiresAt) < new Date()
    : false;

  async function call(path: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/sourcing/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request failed.");
      } else {
        return json;
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function markAttempt(isFinal: boolean) {
    const result = await call("mark-attempt", { isFinal });
    if (result) {
      setSuccess(isFinal ? "Marked as final attempt. Credit expires in 7 days." : "Options marked as sent.");
      setTimeout(() => window.location.reload(), 800);
    }
  }

  async function generateCheckout() {
    const priceCents = Math.round(parseFloat(itemPriceUsd) * 100);
    if (!itemName.trim() || isNaN(priceCents) || priceCents <= 0) {
      setError("Enter a valid item name and price.");
      return;
    }
    const result = await call("generate-checkout", { itemName: itemName.trim(), priceCents });
    if (result) {
      setShowGenerateForm(false);
      setSuccess(`Checkout link created — expires ${new Date(result.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} today.`);
      setTimeout(() => window.location.reload(), 1200);
    }
  }

  async function regenerateCheckout() {
    const result = await call("regenerate-checkout");
    if (result) {
      setSuccess("New checkout link created.");
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  async function expireCredit() {
    if (!confirm(`Expire $${(availableCredit / 100).toFixed(2)} of remaining credit? This cannot be undone.`)) return;
    const result = await call("expire-credit");
    if (result) {
      setSuccess(`Credit expired ($${(result.expiredCents / 100).toFixed(2)} zeroed out).`);
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  function copyUrl() {
    if (!privateCheckoutUrl) return;
    navigator.clipboard.writeText(privateCheckoutUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800">
      <div className="flex flex-wrap gap-2 items-start">

        {/* Send options (queued or options_sent without final) */}
        {(sourcingStatus === "queued" || (sourcingStatus === "options_sent" && !finalAttemptSentAt)) && (
          <>
            <Btn onClick={() => markAttempt(false)} disabled={loading}>
              {lastAttemptSentAt ? "Resend Options" : "Mark Options Sent"}
            </Btn>
            <Btn
              onClick={() => markAttempt(true)}
              disabled={loading}
              className="border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              Mark as Final Attempt
            </Btn>
          </>
        )}

        {/* Final attempt already sent — show label */}
        {finalAttemptSentAt && sourcingStatus === "options_sent" && (
          <span className="text-xs text-amber-600 dark:text-amber-400 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            Final attempt sent · credit expires {new Date(creditExpiresAt!).toLocaleDateString()}
          </span>
        )}

        {/* Generate checkout — available when options sent or checkout expired */}
        {(sourcingStatus === "options_sent" || sourcingStatus === "checkout_expired" ||
          (sourcingStatus === "accepted_pending_checkout" && !privateCheckoutUrl)) && (
          <>
            {!showGenerateForm ? (
              <Btn
                onClick={() => setShowGenerateForm(true)}
                disabled={loading}
                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                Generate Checkout Link
              </Btn>
            ) : (
              <div className="flex flex-wrap gap-2 items-end w-full">
                <input
                  type="text"
                  placeholder="Item name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-48"
                />
                <input
                  type="number"
                  placeholder="Price (USD)"
                  value={itemPriceUsd}
                  onChange={(e) => setItemPriceUsd(e.target.value)}
                  min="1"
                  step="0.01"
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-28"
                />
                <Btn
                  onClick={generateCheckout}
                  disabled={loading}
                  className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  Create Link
                </Btn>
                <Btn onClick={() => setShowGenerateForm(false)} disabled={loading}>
                  Cancel
                </Btn>
              </div>
            )}
          </>
        )}

        {/* Active checkout — copy link */}
        {privateCheckoutUrl && !checkoutExpired && sourcingStatus === "accepted_pending_checkout" && (
          <Btn
            onClick={copyUrl}
            className="border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          >
            {copied ? "Copied!" : "Copy Checkout Link"}
          </Btn>
        )}

        {/* Regenerate expired checkout */}
        {(sourcingStatus === "checkout_expired" || (checkoutExpired && privateCheckoutUrl)) && (
          <Btn
            onClick={regenerateCheckout}
            disabled={loading}
            className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
          >
            Regenerate Checkout
          </Btn>
        )}

        {/* Expire credit */}
        {availableCredit > 0 && (
          <Btn
            onClick={expireCredit}
            disabled={loading}
            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Expire Credit
          </Btn>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{success}</p>
      )}
    </div>
  );
}
