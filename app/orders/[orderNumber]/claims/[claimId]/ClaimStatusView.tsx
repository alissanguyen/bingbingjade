"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface TimelineEvent { id: string; actor_type: string; action: string; note: string | null; created_at: string }
interface Evidence { id: string; category: string; url: string | null; caption: string | null; created_at: string }
interface ReturnShipment { id: string; tracking_number: string | null; carrier: string | null; label_status: string; customer_dropoff_reported_at: string | null; carrier_acceptance_scan_at: string | null; delivered_to_bbj_at: string | null }
interface ReturnRow { id: string; status: string; dropoff_deadline_at: string | null; return_shipments: ReturnShipment[] }

interface ClaimDetail {
  claim: {
    id: string; claimNumber: string; claimType: string; status: string; customerFacingStatus: string;
    responsibility: string; description: string | null; openedAt: string; resolvedAt: string | null;
    closedAt: string | null; packagingAckAt: string | null; insuranceMessage: string | null;
  };
  items: { id: string; product_name: string; item_price_usd: number | null }[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  returns: ReturnRow[];
  resolution: { resolution_type: string; customer_summary: string | null; decided_at: string } | null;
}

export default function ClaimStatusView({ orderNumber, claimId }: { orderNumber: string; claimId: string }) {
  const [data, setData] = useState<ClaimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/orders/${orderNumber}/claims/${claimId}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError("Claim not found."));
  }, [orderNumber, claimId]);

  useEffect(() => { load(); }, [load]);

  async function reportDropoff() {
    await fetch(`/api/orders/${orderNumber}/claims/${claimId}/dropoff`, { method: "POST" });
    load();
  }

  async function uploadMore(file: File) {
    const urlRes = await fetch(`/api/orders/${orderNumber}/claims/${claimId}/evidence`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "upload-url", filename: file.name }),
    });
    const { signedUrl, path } = await urlRes.json();
    if (!signedUrl) return;
    await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    await fetch(`/api/orders/${orderNumber}/claims/${claimId}/evidence`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: path, category: "item_photo", filename: file.name, contentType: file.type }),
    });
    load();
  }

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;

  const { claim } = data;
  const latestReturn = data.returns[0];
  const latestShipment = latestReturn?.return_shipments?.[0];
  const needsEvidence = claim.status === "additional_evidence_requested";

  return (
    <div>
      <Link href={`/orders/${orderNumber}`} className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">&larr; Back to order</Link>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Claim {claim.claimNumber}</h1>
        <span className="text-xs font-medium rounded-full px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {claim.customerFacingStatus}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Order {orderNumber} · Opened {new Date(claim.openedAt).toLocaleDateString()}</p>

      {claim.insuranceMessage && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 text-sm text-gray-600 dark:text-gray-300 mb-6">
          {claim.insuranceMessage}
        </div>
      )}

      {needsEvidence && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">Action required: upload additional photos</p>
          <input type="file" accept="image/*,video/*" multiple onChange={(e) => Array.from(e.target.files ?? []).forEach(uploadMore)} />
        </div>
      )}

      {/* Always available while the claim is open — e.g. if a photo failed
          to upload during submission, or the customer just has more to add. */}
      {!needsEvidence && claim.status !== "closed" && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add more photos</p>
          <input type="file" accept="image/*,video/*" multiple onChange={(e) => Array.from(e.target.files ?? []).forEach(uploadMore)} />
        </div>
      )}

      {latestShipment && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 mb-6 space-y-2 text-sm">
          <p className="font-semibold text-gray-700 dark:text-gray-300">Return shipment</p>
          {latestReturn.dropoff_deadline_at && (
            <p className="text-gray-600 dark:text-gray-300">Please drop off your return by <strong>{new Date(latestReturn.dropoff_deadline_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</strong>.</p>
          )}
          {latestShipment.tracking_number && <p className="text-gray-500 dark:text-gray-400">Tracking: {latestShipment.carrier} {latestShipment.tracking_number}</p>}
          <p className="text-gray-500 dark:text-gray-400">
            Status: {latestShipment.delivered_to_bbj_at ? "Delivered to us" : latestShipment.carrier_acceptance_scan_at ? "In transit" : latestShipment.customer_dropoff_reported_at ? "Drop-off reported — awaiting carrier scan" : "Awaiting drop-off"}
          </p>
          {!latestShipment.customer_dropoff_reported_at && (
            <button onClick={reportDropoff} className="rounded-full border border-emerald-600 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
              I&apos;ve dropped off my return
            </button>
          )}
        </div>
      )}

      {data.resolution && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Resolution</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{data.resolution.customer_summary ?? "A resolution has been issued for your claim."}</p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Affected item(s)</p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          {data.items.map((i) => <li key={i.id}>{i.product_name}{i.item_price_usd != null && ` · $${i.item_price_usd.toFixed(2)}`}</li>)}
        </ul>
      </div>

      {data.evidence.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Evidence submitted</p>
          <div className="grid grid-cols-3 gap-2">
            {data.evidence.map((e) => e.url && (
              <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-800">
                <img src={e.url} alt={e.caption ?? e.category} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Timeline</p>
        <ul className="space-y-3">
          {data.timeline.map((t) => (
            <li key={t.id} className="text-sm">
              <span className="text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
              <span className="text-gray-700 dark:text-gray-300 ml-2">{t.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
