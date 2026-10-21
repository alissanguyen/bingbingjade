"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ClaimData {
  claim: {
    id: string; claim_number: string; claim_type: string; claim_subtype: string | null; fit_issue: string | null;
    status: string; responsibility: string; priority: string; assigned_admin: string | null;
    next_action: string | null; description: string | null; customer_email: string;
    eligibility_result: string; eligibility_reason: string | null;
    packaging_ack_at: string | null; resolution_id: string | null;
    opened_at: string; closed_at: string | null;
    orders: { order_number: string | null; customer_name: string | null; customer_email: string | null; stripe_payment_intent_id: string | null };
  };
  items: { id: string; product_name: string; item_price_usd: number | null; sku: string | null; order_item_id: string }[];
  evidence: { id: string; category: string; url: string | null; customer_visible: boolean; uploaded_by_type: string }[];
  timeline: { id: string; actor_type: string; actor: string; action: string; internal_note: string | null; customer_note: string | null; created_at: string }[];
  returns: { id: string; return_number: string; status: string; dropoff_deadline_at: string | null; return_shipments: { id: string; tracking_number: string | null; carrier_acceptance_scan_at: string | null }[] }[];
  resolutions: { id: string; resolution_type: string; decided_at: string; customer_summary: string | null }[];
  financialSummary: { netClaimImpactUsd: number; events: { id: string; event_type: string; amount_usd: number; created_at: string }[] };
}

const btnCls = "rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 transition-colors";
const primaryBtnCls = "rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition-colors";
const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100";

export function ClaimDetailAdminClient({ claimId }: { claimId: string }) {
  const [data, setData] = useState<ClaimData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/claims/${claimId}`).then((r) => r.json()).then(setData);
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) alert(json.error ?? "Action failed.");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmCarrierAcceptance(returnShipmentId: string, returnId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/claims/${claimId}/return/label`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnShipmentId, returnId }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.error ?? "Action failed.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="px-6 py-8 text-sm text-gray-400">Loading…</p>;
  const { claim } = data;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/claims-admin" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">&larr; All claims</Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{claim.claim_number}</h1>
        <div className="flex gap-2">
          {claim.orders.order_number && (
            <Link href={`/orders-admin/${claim.orders.order_number}`} className={btnCls}>View Order</Link>
          )}
          {claim.status === "closed" && (
            <button className={btnCls} disabled={busy} onClick={() => {
              const reason = prompt("Reopen reason?");
              if (reason) post(`/api/admin/claims/${claimId}/reopen`, { reason });
            }}>Reopen</button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {claim.claim_type.replace(/_/g, " ")}{claim.claim_subtype ? ` · ${claim.claim_subtype.replace(/_/g, " ")}` : ""}
        {claim.fit_issue ? ` · ${claim.fit_issue.replace(/_/g, " ")}` : ""} · {claim.customer_email}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
        <Info label="Status" value={claim.status.replace(/_/g, " ")} />
        <Info label="Responsibility" value={claim.responsibility.replace(/_/g, " ")} />
        <Info label="Eligibility" value={claim.eligibility_result.replace(/_/g, " ")} />
        <Info label="Assigned" value={claim.assigned_admin ?? "—"} />
      </div>

      {claim.eligibility_reason && <p className="text-xs text-gray-400 mb-6">Eligibility reason: {claim.eligibility_reason}</p>}
      {claim.description && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Customer description</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{claim.description}</p>
        </div>
      )}

      {/* Status / next action */}
      <Section title="Update status">
        <StatusForm claimId={claimId} busy={busy} onSubmit={(body) => post(`/api/admin/claims/${claimId}/status`, body)} />
      </Section>

      {/* Request evidence */}
      <Section title="Request additional evidence">
        <InlineForm placeholder="Message to customer (optional — has a sensible default)" busy={busy}
          onSubmit={(message) => post(`/api/admin/claims/${claimId}/request-evidence`, { message: message || undefined, notify: true })} />
      </Section>

      {/* Items */}
      <Section title="Affected items">
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          {data.items.map((i) => <li key={i.id}>{i.product_name} {i.sku && <span className="text-gray-400 font-mono text-xs">({i.sku})</span>} {i.item_price_usd != null && `· $${i.item_price_usd.toFixed(2)}`}</li>)}
        </ul>
      </Section>

      {/* Evidence */}
      <Section title="Evidence">
        <div className="grid grid-cols-4 gap-2">
          {data.evidence.map((e) => e.url && (
            <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="relative block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-800">
              <img src={e.url} alt={e.category} className="w-full h-full object-cover" />
              {!e.customer_visible && <span className="absolute top-1 right-1 text-[10px] bg-gray-900/80 text-white px-1 rounded">internal</span>}
            </a>
          ))}
          {data.evidence.length === 0 && <p className="text-sm text-gray-400">No evidence uploaded yet.</p>}
        </div>
      </Section>

      {/* Return */}
      <Section title="Return">
        {data.returns.length === 0 ? (
          <CreateReturnForm claimId={claimId} busy={busy} onSubmit={(body) => post(`/api/admin/claims/${claimId}/return`, body)} />
        ) : (
          data.returns.map((r) => (
            <div key={r.id} className="mb-4 last:mb-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.return_number} — {r.status.replace(/_/g, " ")}</p>
              {r.dropoff_deadline_at && <p className="text-xs text-gray-400">Deadline: {new Date(r.dropoff_deadline_at).toLocaleString()}</p>}
              {r.return_shipments.length === 0 ? (
                <RecordLabelForm returnId={r.id} claimId={claimId} busy={busy} onSubmit={(body) => post(`/api/admin/claims/${claimId}/return/label`, { returnId: r.id, ...body })} />
              ) : (
                r.return_shipments.map((s) => (
                  <div key={s.id} className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
                    <span>{s.tracking_number ?? "no tracking #"}</span>
                    {!s.carrier_acceptance_scan_at && (
                      <button className={btnCls} disabled={busy} onClick={() => confirmCarrierAcceptance(s.id, r.id)}>
                        Confirm carrier acceptance
                      </button>
                    )}
                  </div>
                ))
              )}
              <InspectionForm returnId={r.id} claimId={claimId} busy={busy} onSubmit={(body) => post(`/api/admin/claims/${claimId}/return/inspection`, { returnId: r.id, ...body })} />
            </div>
          ))
        )}
      </Section>

      {/* Resolution */}
      <Section title="Resolution">
        {data.resolutions.length > 0 ? (
          data.resolutions.map((r) => (
            <p key={r.id} className="text-sm text-gray-700 dark:text-gray-300">{r.resolution_type.replace(/_/g, " ")} — {new Date(r.decided_at).toLocaleDateString()} {r.customer_summary && `— ${r.customer_summary}`}</p>
          ))
        ) : (
          <ResolutionForm claimId={claimId} busy={busy} onSubmit={(body) => post(`/api/admin/claims/${claimId}/resolution`, body)} />
        )}
      </Section>

      {/* Financial summary */}
      <Section title="Financial summary">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Net claim impact: ${data.financialSummary.netClaimImpactUsd.toFixed(2)}</p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          {data.financialSummary.events.map((e) => (
            <li key={e.id}>{e.event_type.replace(/_/g, " ")}: {e.amount_usd < 0 ? "-" : "+"}${Math.abs(e.amount_usd).toFixed(2)}</li>
          ))}
        </ul>
      </Section>

      {/* Timeline */}
      <Section title="Timeline">
        <ul className="space-y-2">
          {data.timeline.map((t) => (
            <li key={t.id} className="text-sm">
              <span className="text-gray-400 text-xs">{new Date(t.created_at).toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">[{t.actor_type}:{t.actor}]</span>
              <span className="text-gray-700 dark:text-gray-300 ml-2">{t.internal_note ?? t.customer_note ?? t.action}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-gray-800 dark:text-gray-200 font-medium">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</p>
      {children}
    </div>
  );
}

function InlineForm({ placeholder, busy, onSubmit }: { placeholder: string; busy: boolean; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={inputCls} />
      <button className={primaryBtnCls} disabled={busy} onClick={() => { onSubmit(value); setValue(""); }}>Send</button>
    </div>
  );
}

const STATUS_OPTIONS = [
  "received", "initial_review", "evidence_received", "bbj_reviewing", "carrier_investigation_opened",
  "carrier_contacted", "insurance_claim_filed", "carrier_insurance_claim_filed", "awaiting_carrier_decision",
  "additional_evidence_requested", "approved", "denied", "package_located", "resolution_offered",
  "customer_accepted_resolution", "return_approved", "return_denied", "label_issued", "awaiting_dropoff",
  "return_in_transit", "return_delivered", "inspecting", "resolution_issued", "closed",
];
const RESPONSIBILITY_OPTIONS = ["bbj_action_required", "customer_action_required", "waiting_on_carrier", "waiting_on_insurer", "waiting_on_vendor", "return_in_transit", "inspecting", "resolution_pending", "closed"];

function StatusForm({ busy, onSubmit }: { claimId: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [newStatus, setNewStatus] = useState(STATUS_OPTIONS[0]);
  const [responsibility, setResponsibility] = useState(RESPONSIBILITY_OPTIONS[0]);
  const [customerNote, setCustomerNote] = useState("");
  const [notify, setNotify] = useState(true);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputCls + " max-w-xs"}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={responsibility} onChange={(e) => setResponsibility(e.target.value)} className={inputCls + " max-w-xs"}>
          {RESPONSIBILITY_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <input value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="Customer-visible note" className={inputCls} />
      <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify customer by email</label>
      <button className={primaryBtnCls} disabled={busy} onClick={() => onSubmit({ newStatus, responsibility, customerNote: customerNote || undefined, notify })}>Update</button>
    </div>
  );
}

function CreateReturnForm({ busy, onSubmit }: { claimId: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [returnType, setReturnType] = useState("not_as_described");
  const [deadline, setDeadline] = useState("");
  return (
    <div className="space-y-2">
      <select value={returnType} onChange={(e) => setReturnType(e.target.value)} className={inputCls}>
        <option value="damage_insurance_return">Damage / insurance return</option>
        <option value="not_as_described">Not as described</option>
        <option value="sizing_refund">Sizing — refund</option>
        <option value="sizing_exchange">Sizing — exchange</option>
      </select>
      <div>
        <label className="text-xs text-gray-400">Drop-off deadline</label>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
      </div>
      <button className={primaryBtnCls} disabled={busy} onClick={() => onSubmit({ returnType, dropoffDeadlineAt: deadline ? new Date(deadline).toISOString() : undefined })}>Approve return</button>
    </div>
  );
}

function RecordLabelForm({ busy, onSubmit }: { returnId: string; claimId: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [carrier, setCarrier] = useState("UPS");
  const [tracking, setTracking] = useState("");
  const [cost, setCost] = useState("");
  return (
    <div className="mt-2 flex gap-2 flex-wrap items-end">
      <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className={inputCls + " max-w-[120px]"} />
      <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking #" className={inputCls + " max-w-[180px]"} />
      <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Label cost $" className={inputCls + " max-w-[120px]"} />
      <button className={btnCls} disabled={busy} onClick={() => onSubmit({ carrier, trackingNumber: tracking || undefined, quotedLabelCostCents: cost ? Math.round(parseFloat(cost) * 100) : 0 })}>Record label</button>
    </div>
  );
}

const INSPECTION_RESULTS = ["approved_as_received", "approved_with_deduction", "needs_further_review", "incorrect_item_returned", "item_materially_damaged", "missing_required_components", "rejected", "admin_override"];

function InspectionForm({ busy, onSubmit }: { returnId: string; claimId: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [result, setResult] = useState(INSPECTION_RESULTS[0]);
  const [notes, setNotes] = useState("");
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-wrap items-end">
      <select value={result} onChange={(e) => setResult(e.target.value)} className={inputCls + " max-w-xs"}>
        {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
      </select>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition notes" className={inputCls} />
      <button className={btnCls} disabled={busy} onClick={() => onSubmit({ result, conditionNotes: notes || undefined })}>Record inspection</button>
    </div>
  );
}

function ResolutionForm({ busy, onSubmit }: { claimId: string; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [resolutionType, setResolutionType] = useState("full_cash_refund");
  const [customerSummary, setCustomerSummary] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("stripe");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditKind, setCreditKind] = useState("store_credit");

  function submit() {
    const body: Record<string, unknown> = { resolutionType, customerSummary: customerSummary || undefined, notify: true };
    if (refundAmount) body.refund = { amountCents: Math.round(parseFloat(refundAmount) * 100), method: refundMethod };
    if (creditAmount) body.credit = { amountCents: Math.round(parseFloat(creditAmount) * 100), kind: creditKind };
    onSubmit(body);
  }

  return (
    <div className="space-y-3">
      <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value)} className={inputCls}>
        <option value="full_cash_refund">Full cash refund</option>
        <option value="partial_cash_refund">Partial cash refund</option>
        <option value="store_credit">Store credit</option>
        <option value="exchange_credit">Exchange credit</option>
        <option value="combination">Combination (refund + credit)</option>
        <option value="replacement_merchandise">Replacement merchandise</option>
        <option value="repair_restoration">Repair / restoration</option>
        <option value="denied">Denied</option>
        <option value="other">Other</option>
      </select>
      <input value={customerSummary} onChange={(e) => setCustomerSummary(e.target.value)} placeholder="Customer-facing summary of the resolution" className={inputCls} />
      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-400">Cash refund $</label>
          <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className={inputCls + " max-w-[120px]"} />
        </div>
        <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className={inputCls + " max-w-[130px]"}>
          <option value="stripe">Stripe</option>
          <option value="zelle">Zelle</option>
          <option value="ach">ACH</option>
          <option value="wire">Wire</option>
          <option value="check">Check</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
        <div>
          <label className="text-xs text-gray-400">Credit $</label>
          <input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className={inputCls + " max-w-[120px]"} />
        </div>
        <select value={creditKind} onChange={(e) => setCreditKind(e.target.value)} className={inputCls + " max-w-[150px]"}>
          <option value="store_credit">Store credit</option>
          <option value="exchange_credit">Exchange credit</option>
        </select>
      </div>
      <button className={primaryBtnCls} disabled={busy} onClick={submit}>Issue resolution</button>
    </div>
  );
}
