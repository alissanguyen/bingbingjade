"use client";

import { useState } from "react";

type OptionStatus = "draft" | "active" | "rejected" | "accepted" | "converted_to_checkout" | "paid" | "expired";
type AttemptStatus = "draft" | "sent" | "responded" | "expired" | "accepted" | "closed";

interface AttemptOption {
  id: string;
  title: string;
  images_json: string[];
  price_cents: number;
  tier: string | null;
  color: string | null;
  dimensions: string | null;
  notes: string | null;
  status: OptionStatus;
  customer_reaction: "liked" | "disliked" | "neutral" | null;
  customer_note: string | null;
  sort_order: number | null;
}

interface Attempt {
  id: string;
  attempt_number: number;
  status: AttemptStatus;
  sent_at: string | null;
  response_due_at: string | null;
  responded_at: string | null;
  customer_feedback: string | null;
  admin_notes: string | null;
  sourcing_attempt_options: AttemptOption[];
}

interface Props {
  requestId: string;
  sourcingStatus: string;
  paymentStatus: string;
  maxAttempts: number;
  attemptsUsed: number;
  publicToken: string | null;
  availableCreditCents: number;
  initialAttempts: Attempt[];
}

const REACTION_LABELS: Record<string, string> = {
  liked:    "Liked",
  disliked: "Disliked",
  neutral:  "Neutral",
};

const REACTION_COLORS: Record<string, string> = {
  liked:    "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  disliked: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  neutral:  "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const ATTEMPT_STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  sent:      "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  responded: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  expired:   "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  accepted:  "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  closed:    "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

function Btn({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "amber" | "violet";
  children: React.ReactNode;
}) {
  const variants: Record<string, string> = {
    default: "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
    primary: "border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    danger:  "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20",
    amber:   "border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20",
    violet:  "border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function FieldInput({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

function FieldTextarea({
  label, value, onChange, placeholder, rows = 2,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 mb-0.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
      />
    </div>
  );
}

interface OptionFormState {
  title: string;
  priceUsd: string;
  tier: string;
  color: string;
  dimensions: string;
  notes: string;
  images: string[]; // public URLs
}

const emptyForm = (): OptionFormState => ({
  title: "", priceUsd: "", tier: "", color: "", dimensions: "", notes: "", images: [],
});

export function AttemptManager({
  requestId,
  sourcingStatus,
  paymentStatus,
  maxAttempts,
  attemptsUsed,
  publicToken,
  availableCreditCents,
  initialAttempts,
}: Props) {
  const [attempts, setAttempts] = useState<Attempt[]>(initialAttempts);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Per-attempt state
  const [showAddOption, setShowAddOption] = useState<Record<string, boolean>>({});
  const [optionForms, setOptionForms] = useState<Record<string, OptionFormState>>({});
  const [editingOption, setEditingOption] = useState<Record<string, OptionFormState>>({});
  const [savingOption, setSavingOption] = useState<Record<string, boolean>>({});
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});

  const isDone = ["fulfilled", "cancelled", "closed"].includes(sourcingStatus);
  const isPaid = paymentStatus === "paid";
  const canCreateAttempt = isPaid && !isDone && (attemptsUsed < maxAttempts);
  const hasDraftOrSent = attempts.some((a) => ["draft", "sent"].includes(a.status));

  async function apiCall(url: string, body?: unknown): Promise<unknown> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function apiDelete(url: string): Promise<void> {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? "Delete failed");
    }
  }

  async function apiPut(url: string, body: unknown): Promise<unknown> {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? "Update failed");
    return json;
  }

  async function uploadImages(
    files: FileList,
    formKey: string,
    getCurrentImages: () => string[],
    setImages: (imgs: string[]) => void
  ) {
    setUploadingImages((p) => ({ ...p, [formKey]: true }));
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/sourcing/upload-option-image", { method: "POST", body: fd });
        const json = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        if (json.url) uploaded.push(json.url);
      } catch (e) {
        setGlobalError((e as Error).message);
      }
    }
    if (uploaded.length) setImages([...getCurrentImages(), ...uploaded]);
    setUploadingImages((p) => ({ ...p, [formKey]: false }));
  }

  function setMsg(err: string | null, ok: string | null) {
    setGlobalError(err);
    setGlobalSuccess(ok);
    if (ok) setTimeout(() => setGlobalSuccess(null), 3000);
  }

  async function createAttempt() {
    setGlobalLoading(true); setMsg(null, null);
    try {
      const data = await apiCall(`/api/admin/sourcing/${requestId}/attempts`) as { attempt: Attempt };
      setAttempts((prev) => [...prev, { ...data.attempt, sourcing_attempt_options: [] }]);
      setMsg(null, `Round ${data.attempt.attempt_number} draft created.`);
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function addOption(attemptId: string) {
    const form = optionForms[attemptId] ?? emptyForm();
    const priceCents = Math.round(parseFloat(form.priceUsd) * 100);
    if (!form.title.trim() || isNaN(priceCents) || priceCents <= 0) {
      setMsg("Title and a valid price are required.", null);
      return;
    }
    setSavingOption((prev) => ({ ...prev, [attemptId]: true })); setMsg(null, null);
    try {
      const data = await apiCall(`/api/admin/sourcing/attempts/${attemptId}/options`, {
        title:       form.title.trim(),
        price_cents: priceCents,
        tier:        form.tier.trim() || null,
        color:       form.color.trim() || null,
        dimensions:  form.dimensions.trim() || null,
        notes:       form.notes.trim() || null,
        images_json: form.images,
      }) as { option: AttemptOption };
      setAttempts((prev) => prev.map((a) =>
        a.id === attemptId
          ? { ...a, sourcing_attempt_options: [...a.sourcing_attempt_options, data.option] }
          : a
      ));
      setOptionForms((prev) => ({ ...prev, [attemptId]: emptyForm() }));
      setShowAddOption((prev) => ({ ...prev, [attemptId]: false }));
      setMsg(null, "Option added.");
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setSavingOption((prev) => ({ ...prev, [attemptId]: false }));
    }
  }

  async function deleteOption(attemptId: string, optionId: string) {
    if (!confirm("Remove this option?")) return;
    setMsg(null, null);
    try {
      await apiDelete(`/api/admin/sourcing/attempts/${attemptId}/options/${optionId}`);
      setAttempts((prev) => prev.map((a) =>
        a.id === attemptId
          ? { ...a, sourcing_attempt_options: a.sourcing_attempt_options.filter((o) => o.id !== optionId) }
          : a
      ));
      setMsg(null, "Option removed.");
    } catch (e) {
      setMsg((e as Error).message, null);
    }
  }

  async function saveOptionEdit(attemptId: string, optionId: string) {
    const form = editingOption[optionId];
    if (!form) return;
    const priceCents = Math.round(parseFloat(form.priceUsd) * 100);
    if (!form.title.trim() || isNaN(priceCents) || priceCents <= 0) {
      setMsg("Title and valid price required.", null);
      return;
    }
    setSavingOption((prev) => ({ ...prev, [optionId]: true })); setMsg(null, null);
    try {
      const data = await apiPut(`/api/admin/sourcing/attempts/${attemptId}/options/${optionId}`, {
        title:       form.title.trim(),
        price_cents: priceCents,
        tier:        form.tier.trim() || null,
        color:       form.color.trim() || null,
        dimensions:  form.dimensions.trim() || null,
        notes:       form.notes.trim() || null,
        images_json: form.images,
      }) as { option: AttemptOption };
      setAttempts((prev) => prev.map((a) =>
        a.id === attemptId
          ? { ...a, sourcing_attempt_options: a.sourcing_attempt_options.map((o) => o.id === optionId ? data.option : o) }
          : a
      ));
      setEditingOption((prev) => { const n = { ...prev }; delete n[optionId]; return n; });
      setMsg(null, "Option updated.");
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setSavingOption((prev) => ({ ...prev, [optionId]: false }));
    }
  }

  function startEditOption(option: AttemptOption) {
    setEditingOption((prev) => ({
      ...prev,
      [option.id]: {
        title:      option.title,
        priceUsd:   (option.price_cents / 100).toFixed(2),
        tier:       option.tier ?? "",
        color:      option.color ?? "",
        dimensions: option.dimensions ?? "",
        notes:      option.notes ?? "",
        images:     (option.images_json as string[]) ?? [],
      },
    }));
  }

  async function sendAttempt(attemptId: string) {
    if (!confirm("Send this attempt to the customer? This cannot be undone.")) return;
    setGlobalLoading(true); setMsg(null, null);
    try {
      await apiCall(`/api/admin/sourcing/attempts/${attemptId}/send`);
      setMsg(null, "Attempt sent! Customer has been notified.");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function resendLastEmail() {
    setGlobalLoading(true); setMsg(null, null);
    try {
      const data = await apiCall(`/api/admin/sourcing/${requestId}/resend-email`) as { resent: string; attemptNumber?: number };
      const label =
        data.resent === "checkout_offer"      ? "Checkout offer email resent." :
        data.resent === "attempt"             ? `Round ${data.attemptNumber} options email resent.` :
                                               "Deposit confirmation email resent.";
      setMsg(null, label);
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function closeRequest() {
    if (!confirm("Close this request? The customer will no longer be able to accept options.")) return;
    setGlobalLoading(true); setMsg(null, null);
    try {
      await apiCall(`/api/admin/sourcing/${requestId}/close`);
      setMsg(null, "Request closed.");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function voidCredit() {
    if (!confirm(`Void $${(availableCreditCents / 100).toFixed(2)} of remaining credit and cancel this request?`)) return;
    setGlobalLoading(true); setMsg(null, null);
    try {
      await apiCall(`/api/admin/sourcing/${requestId}/void-credit`);
      setMsg(null, "Credit voided and request cancelled.");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg((e as Error).message, null);
    } finally {
      setGlobalLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Section header + global actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Attempt Rounds
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({attempts.length}/{maxAttempts} created · {attemptsUsed} sent)
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {canCreateAttempt && !hasDraftOrSent && (
            <Btn variant="primary" onClick={createAttempt} disabled={globalLoading}>
              + New Round
            </Btn>
          )}
          {isPaid && (
            <Btn variant="default" onClick={resendLastEmail} disabled={globalLoading}>
              Resend Last Email
            </Btn>
          )}
          {!isDone && isPaid && (
            <Btn variant="default" onClick={closeRequest} disabled={globalLoading}>
              Close Request
            </Btn>
          )}
          {!isDone && isPaid && availableCreditCents > 0 && (
            <Btn variant="danger" onClick={voidCredit} disabled={globalLoading}>
              Void Credit (${(availableCreditCents / 100).toFixed(2)})
            </Btn>
          )}
        </div>
      </div>

      {/* Status messages */}
      {globalError && <p className="text-xs text-red-600 dark:text-red-400">{globalError}</p>}
      {globalSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400">{globalSuccess}</p>}

      {!isPaid && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          Deposit not yet paid — attempt management is locked.
        </div>
      )}

      {/* No attempts yet */}
      {attempts.length === 0 && isPaid && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No rounds yet.</p>
          {canCreateAttempt && (
            <Btn variant="primary" onClick={createAttempt} disabled={globalLoading}>
              Create First Round
            </Btn>
          )}
        </div>
      )}

      {/* Attempt cards */}
      {attempts.map((attempt) => {
        const isDraft = attempt.status === "draft";
        const isSent  = attempt.status === "sent" || attempt.status === "responded";
        const addForm = optionForms[attempt.id] ?? emptyForm();
        const isAddingOption = showAddOption[attempt.id] ?? false;

        return (
          <div key={attempt.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            {/* Attempt header */}
            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Round {attempt.attempt_number}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${ATTEMPT_STATUS_COLORS[attempt.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {attempt.status}
                </span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 space-x-3">
                {attempt.sent_at && <span>Sent {new Date(attempt.sent_at).toLocaleDateString()}</span>}
                {attempt.response_due_at && (
                  <span className={new Date(attempt.response_due_at) < new Date() ? "text-red-500" : ""}>
                    Due {new Date(attempt.response_due_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {attempt.responded_at && <span>Responded {new Date(attempt.responded_at).toLocaleDateString()}</span>}
              </div>
            </div>

            {/* Options list */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {attempt.sourcing_attempt_options.map((opt) => {
                const isEditing = !!editingOption[opt.id];
                const editForm  = editingOption[opt.id];

                return (
                  <div key={opt.id} className="px-5 py-3">
                    {isEditing && editForm ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <FieldInput label="Title" value={editForm.title} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], title: v } }))} />
                        <FieldInput label="Price (USD)" value={editForm.priceUsd} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], priceUsd: v } }))} type="number" />
                        <FieldInput label="Tier" value={editForm.tier} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], tier: v } }))} placeholder="e.g. A-grade, commercial" />
                        <FieldInput label="Color" value={editForm.color} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], color: v } }))} />
                        <FieldInput label="Dimensions" value={editForm.dimensions} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], dimensions: v } }))} />
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 mb-0.5">Images</label>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
                            multiple
                            disabled={uploadingImages[opt.id]}
                            onChange={(e) => e.target.files && uploadImages(
                              e.target.files, opt.id,
                              () => editingOption[opt.id]?.images ?? [],
                              (imgs) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], images: imgs } }))
                            )}
                            className="block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-emerald-50 dark:file:bg-emerald-950/30 file:text-emerald-700 dark:file:text-emerald-300"
                          />
                          {uploadingImages[opt.id] && <p className="text-[10px] text-emerald-600 mt-0.5">Uploading…</p>}
                          {editForm.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {editForm.images.map((url, i) => (
                                <div key={i} className="relative group">
                                  <img src={url} alt="" className="h-14 w-14 object-cover rounded border border-gray-200 dark:border-gray-700" />
                                  <button
                                    type="button"
                                    onClick={() => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], images: p[opt.id].images.filter((_, idx) => idx !== i) } }))}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <FieldTextarea label="Notes" value={editForm.notes} onChange={(v) => setEditingOption((p) => ({ ...p, [opt.id]: { ...p[opt.id], notes: v } }))} />
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                          <Btn variant="primary" onClick={() => saveOptionEdit(attempt.id, opt.id)} disabled={savingOption[opt.id]}>
                            Save
                          </Btn>
                          <Btn onClick={() => setEditingOption((p) => { const n = { ...p }; delete n[opt.id]; return n; })}>
                            Cancel
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.title}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            ${(opt.price_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500">
                            {opt.tier && <span>Tier: {opt.tier}</span>}
                            {opt.color && <span>Color: {opt.color}</span>}
                            {opt.dimensions && <span>Dim: {opt.dimensions}</span>}
                          </div>
                          {opt.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.notes}</p>}
                          {(opt.images_json ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(opt.images_json as string[]).map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline">
                                  Image {i + 1} ↗
                                </a>
                              ))}
                            </div>
                          )}
                          {/* Customer reaction */}
                          {opt.customer_reaction && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${REACTION_COLORS[opt.customer_reaction]}`}>
                                {REACTION_LABELS[opt.customer_reaction]}
                              </span>
                              {opt.customer_note && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 italic">"{opt.customer_note}"</span>
                              )}
                            </div>
                          )}
                          {opt.status !== "draft" && opt.status !== "active" && (
                            <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {opt.status.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        {isDraft && (
                          <div className="flex gap-1.5 shrink-0">
                            <Btn onClick={() => startEditOption(opt)}>Edit</Btn>
                            <Btn variant="danger" onClick={() => deleteOption(attempt.id, opt.id)}>Remove</Btn>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Customer feedback */}
              {attempt.customer_feedback && (
                <div className="px-5 py-3 bg-sky-50 dark:bg-sky-950/20">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-600 dark:text-sky-400 mb-0.5">Customer feedback</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{attempt.customer_feedback}"</p>
                </div>
              )}

              {/* Add option form */}
              {isDraft && isAddingOption && (
                <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Add option</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FieldInput label="Title *" value={addForm.title} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), title: v } }))} placeholder="e.g. Grade A bangle — deep green" />
                    <FieldInput label="Price (USD) *" value={addForm.priceUsd} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), priceUsd: v } }))} type="number" placeholder="0.00" />
                    <FieldInput label="Tier" value={addForm.tier} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), tier: v } }))} placeholder="e.g. A-grade, commercial" />
                    <FieldInput label="Color" value={addForm.color} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), color: v } }))} placeholder="e.g. Apple green" />
                    <FieldInput label="Dimensions" value={addForm.dimensions} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), dimensions: v } }))} placeholder="e.g. 55mm internal diameter" />
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 mb-0.5">Images</label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
                        multiple
                        disabled={uploadingImages[attempt.id]}
                        onChange={(e) => e.target.files && uploadImages(
                          e.target.files, attempt.id,
                          () => (optionForms[attempt.id] ?? emptyForm()).images,
                          (imgs) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), images: imgs } }))
                        )}
                        className="block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-emerald-50 dark:file:bg-emerald-950/30 file:text-emerald-700 dark:file:text-emerald-300"
                      />
                      {uploadingImages[attempt.id] && <p className="text-[10px] text-emerald-600 mt-0.5">Uploading…</p>}
                      {addForm.images.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {addForm.images.map((url, i) => (
                            <div key={i} className="relative group">
                              <img src={url} alt="" className="h-14 w-14 object-cover rounded border border-gray-200 dark:border-gray-700" />
                              <button
                                type="button"
                                onClick={() => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), images: (p[attempt.id]?.images ?? []).filter((_, idx) => idx !== i) } }))}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <FieldTextarea label="Notes" value={addForm.notes} onChange={(v) => setOptionForms((p) => ({ ...p, [attempt.id]: { ...(p[attempt.id] ?? emptyForm()), notes: v } }))} placeholder="Any additional details about this piece..." rows={3} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Btn variant="primary" onClick={() => addOption(attempt.id)} disabled={savingOption[attempt.id]}>
                      Add Option
                    </Btn>
                    <Btn onClick={() => setShowAddOption((p) => ({ ...p, [attempt.id]: false }))}>
                      Cancel
                    </Btn>
                  </div>
                </div>
              )}
            </div>

            {/* Attempt footer actions */}
            {isDraft && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                {!isAddingOption && (
                  <Btn onClick={() => setShowAddOption((p) => ({ ...p, [attempt.id]: true }))}>
                    + Add Option
                  </Btn>
                )}
                {attempt.sourcing_attempt_options.length > 0 && (
                  <Btn variant="violet" onClick={() => sendAttempt(attempt.id)} disabled={globalLoading}>
                    Send Round {attempt.attempt_number} to Customer
                  </Btn>
                )}
              </div>
            )}

            {isSent && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                Awaiting customer response
                {attempt.response_due_at && new Date(attempt.response_due_at) > new Date() && (
                  <> · due {new Date(attempt.response_due_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Show "create next round" when all previous are done */}
      {canCreateAttempt && attempts.length > 0 && !hasDraftOrSent && !isDone && (
        <div className="flex justify-center pt-2">
          <Btn variant="primary" onClick={createAttempt} disabled={globalLoading}>
            + Start Round {attempts.length + 1}
          </Btn>
        </div>
      )}

      {/* Exhausted */}
      {!canCreateAttempt && !isDone && isPaid && attemptsUsed >= maxAttempts && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          Maximum rounds reached ({maxAttempts}/{maxAttempts}). Close the request or void credit to conclude.
        </div>
      )}
    </div>
  );
}
