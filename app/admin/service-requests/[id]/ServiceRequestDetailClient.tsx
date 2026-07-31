"use client";

import { useCallback, useEffect, useState } from "react";

interface ServiceRequestFull {
  id: string;
  request_number: string | null;
  status: string;
  client_type: string | null;
  verified: boolean;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  admin_instructions: string | null;
  admin_notes: string | null;
  assigned_staff: string | null;
  price_cents: number | null;
  capture_status: string | null;
  authorized_amount: number | null;
  captured_amount: number | null;
  authorization_expires_at: string | null;
  quote_amount_cents: number | null;
  quote_notes: string | null;
  quote_sent_at: string | null;
  quote_expires_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  return_tracking_number: string | null;
  return_carrier: string | null;
  decline_reason: string | null;
  created_at: string;
  service: { name: string; slug: string; workflow_mode: string } | null;
}

interface Attachment {
  id: string;
  attachmentType: string;
  uploadedBy: string;
  previewUrl: string | null;
  originalFilename: string | null;
}

interface TimelineEntry {
  id: string;
  action: string;
  actor_user_id: string;
  created_at: string;
}

function money(cents: number | null): string {
  return cents ? `$${(cents / 100).toFixed(2)}` : "—";
}

const STATUS_TRANSITIONS: { value: string; label: string }[] = [
  { value: "received", label: "Mark Item Received" },
  { value: "in_progress", label: "Mark Work In Progress" },
  { value: "quality_control", label: "Mark Quality Control" },
  { value: "ready_to_return", label: "Mark Ready to Return" },
  { value: "shipped_back", label: "Mark Shipped Back" },
  { value: "completed", label: "Mark Completed" },
];

export function ServiceRequestDetailClient({ id }: { id: string }) {
  const [request, setRequest] = useState<ServiceRequestFull | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [declineReason, setDeclineReason] = useState("");
  const [imageInstructions, setImageInstructions] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [statusChoice, setStatusChoice] = useState(STATUS_TRANSITIONS[0].value);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [returnTrackingNumber, setReturnTrackingNumber] = useState("");
  const [returnCarrier, setReturnCarrier] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/service-requests/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load request.");
        return;
      }
      setRequest(data.serviceRequest);
      setAttachments(data.attachments ?? []);
      setTimeline(data.timeline ?? []);
      setAdminNotes(data.serviceRequest.admin_notes ?? "");
    } catch {
      setError("Something went wrong loading this request.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function runAction(url: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Action failed.");
        return false;
      }
      await load();
      return true;
    } catch {
      setActionError("Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveAdminNotes() {
    setBusy(true);
    try {
      await fetch(`/api/admin/service-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminNotes }) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error || !request) return <p className="text-sm text-red-600">{error ?? "Not found."}</p>;

  const isAuthHold = request.capture_status !== null;
  const canApprove = request.status === "pending_review" || request.status === "authorized";
  const canDecline = request.status === "pending_review" || request.status === "authorized" || request.status === "quote_needed";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">{request.service?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{request.request_number ?? request.id.slice(0, 8)}</h1>
          <p className="text-sm text-gray-500 mt-1">{request.customer_name} &lt;{request.customer_email}&gt; {request.customer_phone ? `· ${request.customer_phone}` : ""}</p>
        </div>
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium">{request.status}</span>
      </div>

      {actionError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{actionError}</p>}

      {/* Images */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Photos ({attachments.length})</h2>
        {attachments.length === 0 ? (
          <p className="text-sm text-gray-400">No photos submitted.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {attachments.map((a, idx) => (
              <button key={a.id} type="button" onClick={() => setLightbox(idx)} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl ?? ""} alt="" className="h-full w-full object-cover" />
                <span className={`absolute bottom-0 left-0 right-0 text-[9px] text-center py-0.5 ${a.uploadedBy === "customer" ? "bg-emerald-700/80 text-white" : "bg-amber-700/80 text-white"}`}>
                  {a.uploadedBy === "customer" ? "Customer" : "Staff"}
                </span>
              </button>
            ))}
          </div>
        )}
        {lightbox !== null && attachments[lightbox] && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
            <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachments[lightbox].previewUrl ?? ""} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />
              <div className="flex justify-between items-center mt-3 text-white text-sm">
                <button type="button" disabled={lightbox === 0} onClick={() => setLightbox((i) => (i ?? 0) - 1)} className="disabled:opacity-30">‹ Prev</button>
                <a href={attachments[lightbox].previewUrl ?? "#"} target="_blank" rel="noreferrer" className="underline">Open Original</a>
                <button type="button" disabled={lightbox === attachments.length - 1} onClick={() => setLightbox((i) => (i ?? 0) + 1)} className="disabled:opacity-30">Next ›</button>
              </div>
              <button type="button" onClick={() => setLightbox(null)} className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-black flex items-center justify-center">×</button>
            </div>
          </div>
        )}
      </section>

      {/* Payment / Quote status */}
      <section className="grid sm:grid-cols-2 gap-4">
        {isAuthHold && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1 text-sm">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Payment (Authorization Hold)</p>
            <p className="text-gray-500">Status: {request.capture_status}</p>
            <p className="text-gray-500">Authorized: {money(request.authorized_amount)}</p>
            <p className="text-gray-500">Captured: {money(request.captured_amount)}</p>
            {request.authorization_expires_at && <p className="text-gray-500">Expires: {new Date(request.authorization_expires_at).toLocaleString()}</p>}
          </div>
        )}
        {request.service?.workflow_mode === "quote_required" && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1 text-sm">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Quote</p>
            <p className="text-gray-500">Amount: {money(request.quote_amount_cents)}</p>
            {request.quote_notes && <p className="text-gray-500">Notes: {request.quote_notes}</p>}
            {request.quote_expires_at && <p className="text-gray-500">Expires: {new Date(request.quote_expires_at).toLocaleDateString()}</p>}
          </div>
        )}
      </section>

      {/* Customer notes */}
      {request.notes && (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Customer Notes</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{request.notes}</p>
        </section>
      )}

      {/* Actions */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Actions</h2>

        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <button disabled={busy} onClick={() => runAction(`/api/admin/service-requests/${id}/approve`)} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-medium disabled:opacity-50">
              {isAuthHold ? "Approve & Capture Payment" : "Approve"}
            </button>
          )}
        </div>

        {canDecline && (
          <div className="flex gap-2 items-center">
            <input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
            <button disabled={busy} onClick={() => runAction(`/api/admin/service-requests/${id}/decline`, { reason: declineReason || undefined })} className="rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-medium disabled:opacity-50">
              Decline{isAuthHold ? " & Release Hold" : ""}
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input value={imageInstructions} onChange={(e) => setImageInstructions(e.target.value)} placeholder="What additional photos do you need?" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
          <button disabled={busy || !imageInstructions.trim()} onClick={() => runAction(`/api/admin/service-requests/${id}/request-images`, { instructions: imageInstructions })} className="rounded-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-medium disabled:opacity-50 whitespace-nowrap">
            Request More Images
          </button>
        </div>

        {request.service?.workflow_mode === "quote_required" && (
          <div className="flex flex-wrap gap-2 items-center">
            <input value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="Quote amount ($)" type="number" className="w-32 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
            <input value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} placeholder="Quote notes (optional)" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
            <button
              disabled={busy || !quoteAmount}
              onClick={() => runAction(`/api/admin/service-requests/${id}/quote`, { amountCents: Math.round(parseFloat(quoteAmount) * 100), notes: quoteNotes || undefined })}
              className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {request.quote_amount_cents ? "Revise & Send Quote" : "Send Quote"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs">
            {STATUS_TRANSITIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {statusChoice === "shipped_back" && (
            <>
              <input value={returnTrackingNumber} onChange={(e) => setReturnTrackingNumber(e.target.value)} placeholder="Return tracking #" className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
              <input value={returnCarrier} onChange={(e) => setReturnCarrier(e.target.value)} placeholder="Carrier" className="w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
            </>
          )}
          {statusChoice === "received" && (
            <>
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Incoming tracking # (optional)" className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className="w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs" />
            </>
          )}
          <button
            disabled={busy}
            onClick={() => runAction(`/api/admin/service-requests/${id}/status`, { status: statusChoice, trackingNumber, carrier, returnTrackingNumber, returnCarrier })}
            className="rounded-full bg-gray-800 hover:bg-gray-900 dark:bg-gray-200 dark:text-gray-900 text-white px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            Update Status
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {["request_received", "more_images", "quote_ready", "shipping_instructions"].map((t) => (
            <button key={t} disabled={busy} onClick={() => runAction(`/api/admin/service-requests/${id}/resend-email`, { template: t })} className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-400 hover:border-gray-400 disabled:opacity-50">
              Resend: {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </section>

      {/* Internal notes */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Internal Notes</h2>
        <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <button disabled={busy} onClick={saveAdminNotes} className="mt-2 rounded-full border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:border-gray-400 disabled:opacity-50">
          Save Notes
        </button>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Timeline</h2>
        <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          {timeline.map((t) => (
            <li key={t.id}>{new Date(t.created_at).toLocaleString()} — {t.action.replace(/_/g, " ")} ({t.actor_user_id})</li>
          ))}
          {timeline.length === 0 && <li>No events yet.</li>}
        </ul>
      </section>
    </div>
  );
}
