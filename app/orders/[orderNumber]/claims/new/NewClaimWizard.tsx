"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClaimType = "missing_package" | "damaged_item" | "not_as_described" | "doesnt_fit";

// All four claim types must be reported within 48 hours of delivery — see
// the deadline banner on the form step, computed from claim_windows.
const CLAIM_TYPES: { value: ClaimType; label: string; blurb: string }[] = [
  { value: "missing_package", label: "My package is missing", blurb: "Lost in transit, or marked delivered but you can't find it. Must be reported within 48 hours." },
  { value: "damaged_item", label: "My item arrived damaged", blurb: "Photos required — must be reported within 48 hours of delivery." },
  { value: "not_as_described", label: "My item is not as described", blurb: "Photos required. Must be reported within 48 hours of delivery." },
  { value: "doesnt_fit", label: "My item doesn't fit", blurb: "Ship Now items only. Must be reported within 48 hours of delivery." },
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
  packagingPhotosRequired: boolean;
  writtenExplanationRequired: boolean;
}

type ClaimWindows = Record<
  "damage_reporting_days" | "missing_package_reporting_days" | "ship_now_return_days" | "sizing_return_days",
  number
>;

const PACKAGING_ACK_TEXT = "I confirm that I will keep the original packaging while the shipping/insurance claim is under review.";

const PHOTO_TIPS: Record<ClaimType, string[]> = {
  damaged_item: [
    "A few photos from different angles of the damage",
    "At least one close-up, in focus, showing the damage clearly",
    "Shine your phone's flashlight through or across the stone — this shows cracks, chips, or internal damage that's hard to see in normal light",
    "The outer shipping box (all sides, including the shipping label)",
    "The inner packaging / protective material as you found it",
  ],
  not_as_described: [
    "Photos showing exactly what differs from the listing/order description",
    "A few angles, in good lighting",
    "Include the certificate if the discrepancy relates to it",
  ],
  missing_package: [],
  doesnt_fit: [],
};

function formatWindow(days: number): string {
  return days <= 2 ? `${Math.round(days * 24)} hours` : `${days} day${days === 1 ? "" : "s"}`;
}

function windowDaysFor(claimType: ClaimType, windows: ClaimWindows | null): number | null {
  if (!windows) return null;
  if (claimType === "damaged_item") return windows.damage_reporting_days;
  if (claimType === "missing_package") return windows.missing_package_reporting_days;
  if (claimType === "doesnt_fit") return windows.sizing_return_days;
  if (claimType === "not_as_described") return windows.ship_now_return_days;
  return null;
}

export default function NewClaimWizard({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "form" | "done">("type");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [deliveredAt, setDeliveredAt] = useState<string | null>(null);
  const [claimWindows, setClaimWindows] = useState<ClaimWindows | null>(null);
  const [email, setEmail] = useState("");

  const [claimType, setClaimType] = useState<ClaimType | null>(null);
  const [claimSubtype, setClaimSubtype] = useState("");
  const [fitIssue, setFitIssue] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const [requirement, setRequirement] = useState<EvidenceRequirement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [packagingAck, setPackagingAck] = useState(false);
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);

  // Staged files — held client-side and uploaded only after the claim
  // exists, so the whole form (items, description, photos, packaging ack,
  // email) reads as one continuous step instead of "submit, then somehow
  // find the upload screen."
  const [stagedItemPhotos, setStagedItemPhotos] = useState<File[]>([]);
  const [stagedPackagingPhotos, setStagedPackagingPhotos] = useState<File[]>([]);

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}/claims`)
      .then((r) => r.json())
      .then((d) => {
        setOrderItems(d.orderItems ?? []);
        setDeliveredAt(d.deliveredAt ?? null);
        setClaimWindows(d.claimWindows ?? null);
      });
  }, [orderNumber]);

  useEffect(() => {
    if (!claimType) return;
    fetch(`/api/orders/${orderNumber}/claims/requirements?claimType=${claimType}`)
      .then((r) => r.json())
      .then((d) => setRequirement(d.requirement ?? null));
  }, [claimType, orderNumber]);

  const sourcedForYouSelected = claimType === "doesnt_fit" && selectedItemIds.some((id) => orderItems.find((i) => i.id === id)?.inventory_type === "sourced_for_you");

  const deadline = useMemo(() => {
    if (!claimType || !deliveredAt) return null;
    const days = windowDaysFor(claimType, claimWindows);
    if (days == null) return null;
    return new Date(new Date(deliveredAt).getTime() + days * 86_400_000);
  }, [claimType, deliveredAt, claimWindows]);
  const deadlinePassed = deadline != null && deadline.getTime() < Date.now();

  async function uploadStaged(claimId: string, files: File[], category: "item_photo" | "packaging_outer_photo") {
    for (const file of files) {
      try {
        const urlRes = await fetch(`/api/orders/${orderNumber}/claims/${claimId}/evidence`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "upload-url", filename: file.name }),
        });
        const { signedUrl, path } = await urlRes.json();
        if (!signedUrl) continue;
        await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        await fetch(`/api/orders/${orderNumber}/claims/${claimId}/evidence`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: path, category, filename: file.name, contentType: file.type }),
        });
      } catch {
        // best-effort — a single failed upload shouldn't block the rest
      }
    }
  }

  async function submitClaim() {
    setError(null);
    if (!claimType || selectedItemIds.length === 0) { setError("Select the affected item(s)."); return; }
    if (!email.trim()) { setError("Enter the email on this order."); return; }
    if (requirement?.photosRequired && stagedItemPhotos.length < (requirement.minPhotos || 1)) {
      setError(`Please attach at least ${requirement.minPhotos || 1} photo(s) of the item.`);
      return;
    }
    if (requirement?.packagingPhotosRequired && stagedPackagingPhotos.length < 1) {
      setError("Please attach at least one photo of the packaging.");
      return;
    }
    if (requirement?.originalPackagingRequired && !packagingAck) {
      setError("Please confirm you'll keep the original packaging before continuing.");
      return;
    }
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
      const claimId = data.claim.id as string;
      setCreatedClaimId(claimId);

      setUploading(true);
      await uploadStaged(claimId, stagedItemPhotos, "item_photo");
      await uploadStaged(claimId, stagedPackagingPhotos, "packaging_outer_photo");
      setUploading(false);

      if (requirement?.originalPackagingRequired && packagingAck) {
        await fetch(`/api/orders/${orderNumber}/claims/${claimId}/acknowledge-packaging`, { method: "POST" });
      }

      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  function addFiles(files: FileList | null, target: "item" | "packaging") {
    if (!files) return;
    const max = requirement?.maxPhotos ?? 10;
    const setter = target === "item" ? setStagedItemPhotos : setStagedPackagingPhotos;
    setter((prev) => {
      const combined = [...prev, ...Array.from(files)];
      if (combined.length > max) setError(`You can attach up to ${max} photos.`);
      return combined.slice(0, max);
    });
  }

  function removeFile(index: number, target: "item" | "packaging") {
    const setter = target === "item" ? setStagedItemPhotos : setStagedPackagingPhotos;
    setter((prev) => prev.filter((_, i) => i !== index));
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
              onClick={() => { setClaimType(t.value); setStep("form"); }}
              className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 hover:border-emerald-400 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.blurb}</p>
            </button>
          ))}
        </div>
      )}

      {step === "form" && claimType && (
        <div className="space-y-6">
          {deadline && (
            <div className={`rounded-lg px-4 py-3 text-sm ${deadlinePassed ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
              {deadlinePassed
                ? `This claim type must normally be reported within ${formatWindow(windowDaysFor(claimType, claimWindows)!)} of delivery, which has passed — you can still submit for admin review.`
                : `Please submit this claim within ${formatWindow(windowDaysFor(claimType, claimWindows)!)} of delivery (by ${deadline.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}).`}
            </div>
          )}

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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe what happened {requirement?.writtenExplanationRequired && <span className="text-red-500">*</span>}
            </p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>

          {requirement && (requirement.photosRequired || requirement.packagingPhotosRequired) && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 space-y-5">
              {PHOTO_TIPS[claimType].length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">For the best result, include:</p>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
                    {PHOTO_TIPS[claimType].map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              )}

              {requirement.photosRequired && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Photos of the item <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal"> — at least {requirement.minPhotos || 1}, up to {requirement.maxPhotos}</span>
                  </p>
                  <input type="file" accept="image/*,video/*" multiple onChange={(e) => { addFiles(e.target.files, "item"); e.target.value = ""; }} />
                  <FileChips files={stagedItemPhotos} onRemove={(i) => removeFile(i, "item")} />
                  <p className="text-xs text-gray-400 mt-1">{stagedItemPhotos.length} of {requirement.maxPhotos} attached</p>
                </div>
              )}

              {requirement.packagingPhotosRequired && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Photos of the packaging <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal"> — outer box and inner protective material, up to {requirement.maxPhotos}</span>
                  </p>
                  <input type="file" accept="image/*,video/*" multiple onChange={(e) => { addFiles(e.target.files, "packaging"); e.target.value = ""; }} />
                  <FileChips files={stagedPackagingPhotos} onRemove={(i) => removeFile(i, "packaging")} />
                  <p className="text-xs text-gray-400 mt-1">{stagedPackagingPhotos.length} of {requirement.maxPhotos} attached</p>
                </div>
              )}
            </div>
          )}

          {requirement?.originalPackagingRequired && (
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm cursor-pointer">
              <input type="checkbox" checked={packagingAck} onChange={(e) => setPackagingAck(e.target.checked)} className="mt-1" />
              <span className="text-gray-700 dark:text-gray-300">{PACKAGING_ACK_TEXT}</span>
            </label>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm your email on this order</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button onClick={submitClaim} disabled={submitting}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-6 py-3 text-sm font-medium text-white transition-colors">
            {submitting ? (uploading ? "Uploading photos…" : "Submitting…") : "Submit Claim"}
          </button>
        </div>
      )}
    </div>
  );
}

function FileChips({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 dark:bg-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-gray-300">
          {f.name.length > 20 ? f.name.slice(0, 17) + "…" : f.name}
          <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500">×</button>
        </span>
      ))}
    </div>
  );
}
