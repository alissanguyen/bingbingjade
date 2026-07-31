"use client";

import { useCallback, useEffect, useState } from "react";
import { ServiceRequestImageUploader, type UploadedAttachment } from "../../restoration/ServiceRequestImageUploader";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  awaiting_images: "Awaiting Additional Photos",
  quote_needed: "Preparing Your Quote",
  quote_sent: "Quote Ready",
  awaiting_approval: "Awaiting Your Approval",
  authorization_pending: "Authorizing Payment",
  authorized: "Under Review (Payment Authorized)",
  approved: "Approved",
  rejected: "Not Approved",
  awaiting_shipment: "Ready — Please Ship Your Item",
  received: "Item Received",
  in_progress: "Work In Progress",
  quality_control: "Quality Control",
  ready_to_return: "Ready to Ship Back",
  shipped_back: "Shipped Back to You",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

interface TrackerData {
  serviceRequest: {
    id: string;
    requestNumber: string | null;
    status: string;
    service: { name: string; slug: string } | null;
    priceCents: number | null;
    captureStatus: string | null;
    quoteAmountCents: number | null;
    quoteNotes: string | null;
    quoteExpiresAt: string | null;
    trackingNumber: string | null;
    carrier: string | null;
    returnTrackingNumber: string | null;
    returnCarrier: string | null;
    adminInstructions: string | null;
    createdAt: string;
  };
  attachments: UploadedAttachment[];
  timeline: { id: string; action: string; created_at: string }[];
}

function money(cents: number | null): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

export function ServiceRequestTrackerClient({ token }: { token: string }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAttachments, setNewAttachments] = useState<UploadedAttachment[]>([]);
  const [resubmitting, setResubmitting] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-requests/track/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Request not found.");
        return;
      }
      setData(json);
    } catch {
      setError("Something went wrong loading your request.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleResubmitImages() {
    setResubmitting(true);
    try {
      await fetch(`/api/service-requests/track/${token}/attachments`, { method: "PATCH" });
      await load();
      setNewAttachments([]);
    } finally {
      setResubmitting(false);
    }
  }

  async function handleAcceptQuote() {
    setPayLoading(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/service-requests/track/${token}/accept-quote`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setPayError(json.error ?? "Unable to start checkout.");
        return;
      }
      if (json.url) window.location.href = json.url;
    } catch {
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-sm text-stone-500">Loading your request…</div>;
  }
  if (error || !data) {
    return <div className="min-h-[50vh] flex items-center justify-center text-sm text-red-600">{error ?? "Request not found."}</div>;
  }

  const sr = data.serviceRequest;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          {sr.service?.name ?? "Service Request"}
        </p>
        <h1 className="text-2xl font-semibold text-stone-800 dark:text-gray-100 mt-1">
          {sr.requestNumber ?? `Request ${sr.id.slice(0, 8)}`}
        </h1>
        <p className="mt-2 inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium px-3 py-1">
          {STATUS_LABELS[sr.status] ?? sr.status}
        </p>
      </div>

      {sr.status === "awaiting_images" && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-stone-800 dark:text-gray-100">We need a few more photos</p>
            {sr.adminInstructions && <p className="mt-1 text-xs text-stone-600 dark:text-gray-400 leading-relaxed">{sr.adminInstructions}</p>}
          </div>
          <ServiceRequestImageUploader
            getServiceRequestId={async () => sr.id}
            uploadUrl={() => `/api/service-requests/track/${token}/attachments`}
            minImages={1}
            maxImages={5}
            onChange={setNewAttachments}
          />
          <button
            type="button"
            onClick={handleResubmitImages}
            disabled={newAttachments.length === 0 || resubmitting}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {resubmitting ? "Submitting…" : "Submit Additional Photos"}
          </button>
        </div>
      )}

      {sr.status === "quote_sent" && sr.quoteAmountCents && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-stone-800 dark:text-gray-100">Your Quote</p>
            <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1">{money(sr.quoteAmountCents)}</p>
            {sr.quoteNotes && <p className="mt-2 text-xs text-stone-600 dark:text-gray-400 leading-relaxed">{sr.quoteNotes}</p>}
            {sr.quoteExpiresAt && (
              <p className="mt-2 text-[11px] text-stone-500 dark:text-gray-500">Valid until {new Date(sr.quoteExpiresAt).toLocaleDateString()}</p>
            )}
          </div>
          {payError && <p className="text-xs text-red-600 dark:text-red-400">{payError}</p>}
          <button
            type="button"
            onClick={handleAcceptQuote}
            disabled={payLoading}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {payLoading ? "Preparing checkout…" : `Accept Quote & Pay ${money(sr.quoteAmountCents)}`}
          </button>
        </div>
      )}

      {(sr.trackingNumber || sr.returnTrackingNumber) && (
        <div className="rounded-xl border border-stone-200 dark:border-gray-800 p-5 space-y-2">
          <p className="text-sm font-semibold text-stone-800 dark:text-gray-100">Tracking</p>
          {sr.trackingNumber && <p className="text-xs text-stone-600 dark:text-gray-400">Incoming: {sr.trackingNumber} {sr.carrier ? `(${sr.carrier})` : ""}</p>}
          {sr.returnTrackingNumber && <p className="text-xs text-stone-600 dark:text-gray-400">Return: {sr.returnTrackingNumber} {sr.returnCarrier ? `(${sr.returnCarrier})` : ""}</p>}
        </div>
      )}

      {data.attachments.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-800 dark:text-gray-100 mb-3">Your Photos</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {data.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={a.previewUrl ?? ""} alt="Submitted jade item" className="aspect-square object-cover rounded-lg border border-stone-200 dark:border-gray-700" />
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-stone-400 dark:text-gray-600 border-t border-stone-200 dark:border-gray-800 pt-4">
        Questions about your request? Reply to any of our emails or visit our <a href="/contact" className="underline underline-offset-2">contact page</a>.
      </div>
    </div>
  );
}
