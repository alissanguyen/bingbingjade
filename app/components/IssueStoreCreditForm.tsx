"use client";

import { useState, useEffect } from "react";

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "goodwill_resolution", label: "Goodwill resolution" },
  { value: "canceled_order", label: "Canceled order" },
  { value: "damaged_lost_package", label: "Damaged/lost package resolution" },
  { value: "return", label: "Return" },
  { value: "price_adjustment", label: "Price adjustment" },
  { value: "loyalty_vip", label: "Loyalty/VIP" },
  { value: "other", label: "Other" },
];

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

export interface IssueStoreCreditPrefill {
  customerEmail?: string;
  sourceOrderId?: string;
  sourceOrderNumber?: string;
  currency?: string;
}

export function IssueStoreCreditForm({
  prefill,
  onIssued,
  onCancel,
}: {
  prefill?: IssueStoreCreditPrefill;
  onIssued: (storeCredit: { id: string; code: string }) => void;
  onCancel?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(prefill?.customerEmail ?? "");
  const [reason, setReason] = useState("goodwill_resolution");
  const [customerMessage, setCustomerMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxLineItems, setMaxLineItems] = useState("");
  const [fulfillmentScope, setFulfillmentScope] = useState<"any" | "available_now" | "sourced_for_you">("any");
  const [excludeSaleItems, setExcludeSaleItems] = useState(false);
  const [excludeClearanceItems, setExcludeClearanceItems] = useState(false);
  const [allowWithDiscountCodes, setAllowWithDiscountCodes] = useState(false);
  const [allowWithOtherStoreCredits, setAllowWithOtherStoreCredits] = useState(false);
  const [usageMode, setUsageMode] = useState<"single_use" | "reusable_until_balance_zero">("reusable_until_balance_zero");
  const [maxPerOrder, setMaxPerOrder] = useState("");
  const [maxPercentage, setMaxPercentage] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  // Live preview — recompute condition wording locally, mirroring
  // getStoreCreditDisplayConditions() so what's shown here matches what the
  // customer will actually see in the email and at checkout.
  useEffect(() => {
    const lines: string[] = [];
    if (hasExpiration && expiresAt) {
      lines.push(`Expires on ${new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`);
    }
    if (startsAt && new Date(startsAt).getTime() > Date.now()) {
      lines.push(`Valid starting ${new Date(startsAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`);
    }
    if (minSubtotal) lines.push(`Valid on merchandise purchases of $${Number(minSubtotal).toFixed(2)} or more.`);
    if (maxLineItems) {
      lines.push(Number(maxLineItems) === 1
        ? "May be applied to an order containing one merchandise item only."
        : `May be applied to an order containing up to ${maxLineItems} merchandise items.`);
    }
    if (fulfillmentScope === "available_now") lines.push("Valid for Ship Now pieces only.");
    else if (fulfillmentScope === "sourced_for_you") lines.push("Valid for Sourced for You pieces only.");
    if (excludeSaleItems) lines.push("Not valid on sale items.");
    if (excludeClearanceItems) lines.push("Not valid on clearance items.");
    if (!allowWithDiscountCodes) lines.push("Cannot be combined with another discount code.");
    if (!allowWithOtherStoreCredits) lines.push("Cannot be combined with another store credit.");
    lines.push(usageMode === "single_use"
      ? "This credit may be used once. Any unused amount will be forfeited after redemption."
      : "Any unused balance will remain available until the credit expires.");
    if (maxPerOrder) lines.push(`A maximum of $${Number(maxPerOrder).toFixed(2)} may be applied per order.`);
    if (maxPercentage) lines.push(`The credit may cover up to ${maxPercentage}% of the order total.`);
    lines.push(`This credit is associated with ${email || "[email]"} and is non-transferable.`);
    setPreview(lines);
  }, [hasExpiration, expiresAt, startsAt, minSubtotal, maxLineItems, fulfillmentScope, excludeSaleItems, excludeClearanceItems, allowWithDiscountCodes, allowWithOtherStoreCredits, usageMode, maxPerOrder, maxPercentage, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCents = Math.round(Number(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid credit amount.");
      return;
    }
    if (!email.trim()) {
      setError("Customer email is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          customerEmail: email.trim(),
          sourceOrderId: prefill?.sourceOrderId ?? null,
          currency: prefill?.currency ?? "USD",
          reason,
          customerMessage: customerMessage.trim() || null,
          internalNote: internalNote.trim() || null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          expiresAt: hasExpiration && expiresAt ? new Date(expiresAt).toISOString() : null,
          minimumMerchandiseSubtotalCents: minSubtotal ? Math.round(Number(minSubtotal) * 100) : null,
          maximumLineItems: maxLineItems ? Number(maxLineItems) : null,
          eligibleFulfillmentTypes: fulfillmentScope === "any" ? null : [fulfillmentScope],
          excludeSaleItems,
          excludeClearanceItems,
          allowWithDiscountCodes,
          allowWithOtherStoreCredits,
          usageMode,
          maximumCreditPerOrderCents: maxPerOrder ? Math.round(Number(maxPerOrder) * 100) : null,
          maximumCreditPercentage: maxPercentage ? Number(maxPercentage) : null,
          sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to issue store credit.");
        return;
      }
      onIssued(data.storeCredit);
    } catch {
      setError("Failed to issue store credit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Required Information</h3>

        <div>
          <label className={labelCls}>Credit Amount (USD)</label>
          <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="50.00" />
        </div>

        <div>
          <label className={labelCls}>Customer Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>

        {prefill?.sourceOrderNumber && (
          <div>
            <label className={labelCls}>Source Order</label>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{prefill.sourceOrderNumber}</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Reason for Issuance</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pt-2">Optional Conditions</h3>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="hasExpiration" checked={hasExpiration} onChange={(e) => setHasExpiration(e.target.checked)} />
          <label htmlFor="hasExpiration" className="text-sm text-gray-700 dark:text-gray-300">Set an expiration date</label>
        </div>
        {hasExpiration && (
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
        )}

        <div>
          <label className={labelCls}>Valid Starting (optional)</label>
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Minimum Merchandise Subtotal (USD, optional)</label>
          <input type="number" step="0.01" min="0" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Maximum Number of Items in Cart (optional)</label>
          <input type="number" min="1" value={maxLineItems} onChange={(e) => setMaxLineItems(e.target.value)} className={inputCls} placeholder="e.g. 1 for single-item only" />
        </div>

        <div>
          <label className={labelCls}>Eligible Fulfillment Type</label>
          <select value={fulfillmentScope} onChange={(e) => setFulfillmentScope(e.target.value as typeof fulfillmentScope)} className={inputCls}>
            <option value="any">Either Ship Now or Sourced for You</option>
            <option value="available_now">Ship Now only</option>
            <option value="sourced_for_you">Sourced for You only</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="exSale" checked={excludeSaleItems} onChange={(e) => setExcludeSaleItems(e.target.checked)} />
            <label htmlFor="exSale" className="text-sm text-gray-700 dark:text-gray-300">Exclude sale items</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="exClearance" checked={excludeClearanceItems} onChange={(e) => setExcludeClearanceItems(e.target.checked)} />
            <label htmlFor="exClearance" className="text-sm text-gray-700 dark:text-gray-300">Exclude clearance items</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="allowDisc" checked={allowWithDiscountCodes} onChange={(e) => setAllowWithDiscountCodes(e.target.checked)} />
            <label htmlFor="allowDisc" className="text-sm text-gray-700 dark:text-gray-300">Allow combining with discount codes</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="allowOtherSC" checked={allowWithOtherStoreCredits} onChange={(e) => setAllowWithOtherStoreCredits(e.target.checked)} />
            <label htmlFor="allowOtherSC" className="text-sm text-gray-700 dark:text-gray-300">Allow combining with another store credit</label>
          </div>
        </div>

        <div>
          <label className={labelCls}>Usage Mode</label>
          <select value={usageMode} onChange={(e) => setUsageMode(e.target.value as typeof usageMode)} className={inputCls}>
            <option value="reusable_until_balance_zero">Reusable until balance reaches zero</option>
            <option value="single_use">Single use</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Max $ Per Order (optional)</label>
            <input type="number" step="0.01" min="0" value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Max % of Order (optional)</label>
            <input type="number" step="1" min="1" max="100" value={maxPercentage} onChange={(e) => setMaxPercentage(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Customer-Facing Message (optional)</label>
          <textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} rows={2} className={inputCls} placeholder="Shown in the email — e.g. an apology or thank-you note" />
        </div>

        <div>
          <label className={labelCls}>Internal Admin Note (never shown to customer)</label>
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className={inputCls} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          <label htmlFor="sendEmail" className="text-sm text-gray-700 dark:text-gray-300">Send notification email now</label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-medium transition-colors">
            {saving ? "Issuing…" : "Issue Store Credit"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preview</h3>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Credit Amount</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">${amount ? Number(amount).toFixed(2) : "0.00"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Customer Email</p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Conditions (as shown to customer)</p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              {preview.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
          {customerMessage.trim() && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Customer Message</p>
              <p className="text-sm italic text-gray-700 dark:text-gray-300">&ldquo;{customerMessage.trim()}&rdquo;</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Notification Email</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{sendEmail ? "Will be sent immediately upon issuance" : "Will not be sent — can be sent later from the credit's detail page"}</p>
          </div>
        </div>
      </div>
    </form>
  );
}
