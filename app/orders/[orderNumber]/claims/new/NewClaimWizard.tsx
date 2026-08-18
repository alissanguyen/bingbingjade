"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClaimType = "missing_package" | "damaged_item" | "not_as_described" | "doesnt_fit";

const CLAIM_TYPES: { value: ClaimType; label: string; blurb: string }[] = [
  { value: "missing_package", label: "My package is missing", blurb: "Lost in transit, or marked delivered but you can't find it." },
  { value: "damaged_item", label: "My item arrived damaged", blurb: "Photos required." },
  { value: "not_as_described", label: "My item is not as described", blurb: "Photos required." },
  { value: "doesnt_fit", label: "My item doesn't fit", blurb: "Ship Now items only." },
];

interface OrderItem {
  id: string;
  product_name: string;
  option_label: string | null;
  price_usd: number | null;
  inventory_type: string | null;
}

interface EvidenceRequirement {
  photosRequired: boolean;
  minPhotos: number;
  maxPhotos: number;
  originalPackagingRequired: boolean;
  writtenExplanationRequired: boolean;
}

const PACKAGING_ACK_TEXT = "I confirm that I will keep the original packaging while the shipping/insurance claim is under review.";

export default function NewClaimWizard({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "details" | "evidence" | "done">("type");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [email, setEmail] = useState("");

  const [claimType, setClaimType] = useState<ClaimType | null>(null);
  const [claimSubtype, setClaimSubtype] = useState("");
  const [fitIssue, setFitIssue] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const [requirement, setRequirement] = useState<EvidenceRequirement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [packagingAck, setPackagingAck] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}/claims`)
      .then((r) => r.json())
      .then((d) => setOrderItems(d.orderItems ?? []));
  }, [orderNumber]);

  useEffect(() => {
    if (!claimType) return;
    fetch(`/api/orders/${orderNumber}/claims/requirements?claimType=${claimType}`)
      .then((r) => r.json())
      .then((d) => setRequirement(d.requirement ?? null));
  }, [claimType, orderNumber]);

  const sourcedForYouSelected = claimType === "doesnt_fit" && selectedItemIds.some((id) => orderItems.find((i) => i.id === id)?.inventory_type === "sourced_for_you");

  async function submitClaim() {
    setError(null);
    if (!claimType || selectedItemIds.length === 0) { setError("Select the affected item(s)."); return; }
    if (!email.trim()) { setError("Enter the email on this order."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email.trim(),
          claimType,
          claimSubtype: claimType === "missing_package" ? claimSubtype || undefined : undefined,
          fitIssue: claimType === "doesnt_fit" ? fitIssue || undefined : undefined,
          description: description.trim() || null,
          orderItemIds: selectedItemIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not submit claim."); return; }
      setCreatedClaimId(data.claim.id);
      if (requirement?.photosRequired || requirement?.originalPackagingRequired) {
        setStep("evidence");
      } else {
        setStep("done");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadFile(file: File) {
    if (!createdClaimId) return;
    setUploading(true);
    try {
      const urlRes = await fetch(`/api/orders/${orderNumber}/claims/${createdClaimId}/evidence`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upload-url", filename: file.name }),
      });
      const { signedUrl, path } = await urlRes.json();
      if (!signedUrl) throw new Error("Could not create upload URL");
      await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await fetch(`/api/orders/${orderNumber}/claims/${createdClaimId}/evidence`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path, category: "item_photo", filename: file.name, contentType: file.type }),
      });
      setUploadedCount((c) => c + 1);
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function acknowledgePackaging() {
    if (!createdClaimId) return;
    await fetch(`/api/orders/${orderNumber}/claims/${createdClaimId}/acknowledge-packaging`, { method: "POST" });
    setPackagingAck(true);
  }

  function finishEvidenceStep() {
    if (requirement?.photosRequired && uploadedCount < (requirement.minPhotos || 1)) {
      setError(`Please upload at least ${requirement.minPhotos || 1} photo(s).`);
      return;
    }
    if (requirement?.originalPackagingRequired && !packagingAck) {
      setError("Please confirm you'll keep the original packaging before continuing.");
      return;
    }
    setStep("done");
  }

  if (step === "done" && createdClaimId) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-3">✓</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Claim submitted</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">We&apos;ll keep you updated on this page.</p>
        <Link href={`/orders/${orderNumber}/claims/${createdClaimId}`} className="rounded-full bg-emerald-700 hover:bg-emerald-800 px-6 py-2.5 text-sm font-medium text-white transition-colors">
          View your claim
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-6">&larr; Back</button>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Submit a Claim</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Order {orderNumber}</p>

      {step === "type" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What happened?</p>
          {CLAIM_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setClaimType(t.value); setStep("details"); }}
              className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 hover:border-emerald-400 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.blurb}</p>
            </button>
          ))}
        </div>
      )}

      {step === "details" && claimType && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Which item(s)?</p>
            <div className="space-y-2">
              {orderItems.map((item) => (
                <label key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(e) => setSelectedItemIds((ids) => e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))}
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.product_name}{item.option_label ? ` — ${item.option_label}` : ""}
                    {item.price_usd != null && <span className="text-gray-400"> · ${item.price_usd.toFixed(2)}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {claimType === "doesnt_fit" && sourcedForYouSelected && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3">
              Sourced for You pieces are acquired specifically for your order and are not eligible for sizing-related returns.
              You can still submit this claim for admin review.
            </p>
          )}

          {claimType === "missing_package" && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tell us more</p>
              <select value={claimSubtype} onChange={(e) => setClaimSubtype(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100">
                <option value="">Select one</option>
                <option value="lost_in_transit">It never arrived (lost in transit)</option>
                <option value="marked_delivered_not_located">Tracking shows delivered, but I can&apos;t find it</option>
              </select>
            </div>
          )}

          {claimType === "doesnt_fit" && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What&apos;s the issue?</p>
              <select value={fitIssue} onChange={(e) => setFitIssue(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100">
                <option value="">Select one</option>
                <option value="too_small">Too small</option>
                <option value="too_large">Too large</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Describe what happened</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm your email on this order</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button onClick={submitClaim} disabled={submitting}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-6 py-3 text-sm font-medium text-white transition-colors">
            {submitting ? "Submitting…" : "Submit Claim"}
          </button>
        </div>
      )}

      {step === "evidence" && requirement && (
        <div className="space-y-6">
          {requirement.photosRequired && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload photos {requirement.minPhotos > 0 && `(at least ${requirement.minPhotos})`}
              </p>
              <input type="file" accept="image/*,video/*" multiple onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => uploadFile(f));
              }} />
              <p className="text-xs text-gray-400 mt-2">{uploadedCount} file(s) uploaded{uploading ? " — uploading…" : ""}</p>
            </div>
          )}

          {requirement.originalPackagingRequired && (
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm cursor-pointer">
              <input type="checkbox" checked={packagingAck} onChange={acknowledgePackaging} className="mt-1" />
              <span className="text-gray-700 dark:text-gray-300">{PACKAGING_ACK_TEXT}</span>
            </label>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button onClick={finishEvidenceStep}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 px-6 py-3 text-sm font-medium text-white transition-colors">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
