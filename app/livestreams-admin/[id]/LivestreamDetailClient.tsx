"use client";

import { useState, useCallback, Fragment, useEffect, useRef } from "react";
import type { Livestream, LivestreamItem } from "@/types/livestream";

interface ProductHit {
  id: string;
  name: string;
  sku: string | null;
  size: number | null;
  status: string;
}

function ProductSearch({
  value,
  onSelect,
}: {
  value: { id: string; name: string } | null;
  onSelect: (p: { id: string; name: string } | null) => void;
}) {
  const [query, setQuery]       = useState(value?.name ?? "");
  const [results, setResults]   = useState<ProductHit[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef            = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // When a value is selected from outside (e.g. clear), sync query
  useEffect(() => {
    if (!value) setQuery("");
    else setQuery(value.name);
  }, [value]);

  function handleChange(q: string) {
    setQuery(q);
    onSelect(null); // clear selection while typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/livestreams/product-search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.products ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function select(p: ProductHit) {
    onSelect({ id: p.id, name: p.name });
    setQuery(p.name);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    onSelect(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const inputCls = "w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          className={inputCls}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name or SKU…"
        />
        {value && (
          <button type="button" onClick={clear} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1">✕</button>
        )}
      </div>
      {value && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">Linked: {value.name}</p>
      )}
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {loading && <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start justify-between gap-2"
            >
              <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{p.name}</span>
              <span className="text-gray-400 shrink-0">{p.sku ?? (p.size != null ? `${p.size}mm` : "")}</span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No Ship Now products found</p>
          )}
        </div>
      )}
    </div>
  );
}

type ItemWithRelations = LivestreamItem & {
  product?: { id: string; name: string; status: string; slug: string; public_id: string } | null;
  events?: { id: string; event_type: string; message: string | null; created_at: string; created_by: string | null }[];
};

interface Props {
  livestream: Livestream;
  initialItems: ItemWithRelations[];
}

const STATUS_COLORS: Record<string, string> = {
  available:     "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  checkout_sent: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  paid:          "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  passed:        "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500",
  cancelled:     "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",
};

function $$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

function buildDMMessage(item: ItemWithRelations): string {
  const price = item.checkout_price ?? item.price;
  const expireStr = item.checkout_expires_at
    ? new Date(item.checkout_expires_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
      })
    : "soon";
  const tokenUrl = `${SITE_URL}/livestream-checkout/${item.checkout_token}`;
  return [
    `Hi @${item.buyer_handle}! 🎉 Congrats on claiming ${item.code} — ${item.title_snapshot}${item.size ? ` (Size: ${item.size})` : ""} for $${price.toFixed(2)}.`,
    "",
    "Here's your secure checkout link:",
    tokenUrl,
    "",
    `⏰ Link expires ${expireStr}. Payment locks in your order — no need to DM us once paid!`,
    "",
    "Questions? Just reply here. Thank you for shopping with BingBing Jade! 💚",
  ].join("\n");
}

export function LivestreamDetailClient({ livestream, initialItems }: Props) {
  const [items, setItems] = useState<ItemWithRelations[]>(initialItems);
  const [ls, setLs]       = useState(livestream);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]      = useState<string | null>(null);

  // Claim modal state
  const [claimItem, setClaimItem]   = useState<ItemWithRelations | null>(null);
  const [buyerHandle, setBuyerHandle] = useState("");
  const [buyerPlatform, setBuyerPlatform] = useState("instagram");
  const [checkoutPrice, setCheckoutPrice] = useState("");
  const [priceNote, setPriceNote]   = useState("");
  const [claiming, setClaiming]     = useState(false);
  const [claimResult, setClaimResult] = useState<{ dmMessage: string; tokenUrl: string } | null>(null);

  // Edit item inline
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editTitle, setEditTitle]     = useState("");
  const [editPrice, setEditPrice]     = useState("");
  const [editMinPrice, setEditMinPrice] = useState("");
  const [editCheckoutPrice, setEditCheckoutPrice] = useState("");
  const [editSize, setEditSize]       = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editNotes, setEditNotes]     = useState("");

  // Add items
  const [addCount, setAddCount] = useState("1");
  const [adding, setAdding]     = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/livestreams/${ls.id}`);
    const json = await res.json();
    if (json.items) setItems(json.items);
    if (json.livestream) setLs(json.livestream);
  }, [ls.id]);

  async function handleAddItems() {
    const count = parseInt(addCount, 10);
    if (!count || count < 1) return;
    setAdding(true);
    setMsg(null);
    const res = await fetch(`/api/admin/livestreams/${ls.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (res.ok) { await reload(); setAddCount("1"); }
    else { const j = await res.json(); setMsg(j.error); }
    setAdding(false);
  }

  // Status change
  async function changeStatus(status: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/livestreams/${ls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (res.ok) setLs(json.livestream);
    else setMsg(json.error);
    setSaving(false);
  }

  // Claim
  async function handleClaim() {
    if (!claimItem) return;
    setClaiming(true);
    setMsg(null);
    const res = await fetch(`/api/admin/livestreams/${ls.id}/items/${claimItem.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_handle: buyerHandle.trim(),
        buyer_platform: buyerPlatform,
        checkout_price: checkoutPrice ? parseFloat(checkoutPrice) : undefined,
        price_override_note: priceNote.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error); setClaiming(false); return; }
    setClaimResult({ dmMessage: json.dmMessage, tokenUrl: json.tokenUrl });
    await reload();
    setClaiming(false);
  }

  function openClaimModal(item: ItemWithRelations) {
    setClaimItem(item);
    setBuyerHandle("");
    setBuyerPlatform("instagram");
    setCheckoutPrice(item.price ? String(item.price) : "");
    setPriceNote("");
    setClaimResult(null);
  }

  function closeClaimModal() {
    setClaimItem(null);
    setClaimResult(null);
  }

  // Release
  async function handleRelease(item: ItemWithRelations) {
    if (!confirm(`Release "${item.code}" and make it available again?`)) return;
    const res = await fetch(`/api/admin/livestreams/${ls.id}/items/${item.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Released by admin" }),
    });
    if (res.ok) await reload();
    else { const j = await res.json(); setMsg(j.error); }
  }

  // Save inline edit
  async function saveItemEdit(item: ItemWithRelations) {
    setSaving(true);
    const body: Record<string, unknown> = {
      title_snapshot: editTitle,
      price: parseFloat(editPrice) || 0,
    };
    if (editMinPrice) body.minimum_price = parseFloat(editMinPrice);
    if (editSize)     body.size          = editSize;
    if (editProductId) body.product_id   = editProductId;
    if (editNotes)    body.public_notes  = editNotes;
    if (item.status === "checkout_sent" && editCheckoutPrice) {
      const checkoutPrice = parseFloat(editCheckoutPrice);
      if (checkoutPrice !== (item.checkout_price ?? item.price)) body.checkout_price = checkoutPrice;
    }

    const res = await fetch(`/api/admin/livestreams/${ls.id}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { await reload(); setEditingItem(null); }
    else { const j = await res.json(); setMsg(j.error); }
    setSaving(false);
  }

  function startEdit(item: ItemWithRelations) {
    setEditingItem(item.id);
    setEditTitle(item.title_snapshot);
    setEditPrice(String(item.price));
    setEditMinPrice(item.minimum_price != null ? String(item.minimum_price) : "");
    setEditCheckoutPrice(String(item.checkout_price ?? item.price));
    setEditSize(item.size ?? "");
    setEditProductId(item.product_id ?? "");
    setEditProductName(item.product?.name ?? "");
    setEditNotes(item.public_notes ?? "");
  }

  const lsStatusLabel = ls.status === "live" ? "End Livestream" : ls.status === "draft" ? "Go Live" : null;
  const nextStatus = ls.status === "draft" ? "live" : ls.status === "live" ? "ended" : null;

  const inputCls = "text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a href="/livestreams-admin" className="text-sm text-gray-400 hover:text-gray-600">← Livestreams</a>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{ls.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {ls.platform} · codes {ls.code_prefix}1–{ls.code_prefix}{items.length} · {items.length} items
              {ls.scheduled_at && ` · ${new Date(ls.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {msg && <span className="text-xs text-red-500">{msg}</span>}
            {ls.status !== "ended" && (
              <div className="flex items-center">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={addCount}
                  onChange={(e) => setAddCount(e.target.value)}
                  aria-label="Number of items to add"
                  className="w-14 text-sm border border-r-0 border-gray-300 dark:border-gray-700 rounded-l-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddItems}
                  disabled={adding}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-r-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {adding ? "Adding…" : "+ Add Items"}
                </button>
              </div>
            )}
            {ls.status === "live" && (
              <a
                href={`/livestreams-admin/${ls.id}/live`}
                className="px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Live Mode →
              </a>
            )}
            {nextStatus && lsStatusLabel && (
              <button
                onClick={() => changeStatus(nextStatus)}
                disabled={saving}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  nextStatus === "live"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-gray-300 text-white dark:text-gray-900"
                }`}
              >
                {lsStatusLabel}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Available",     value: items.filter((i) => i.status === "available").length,     color: "text-gray-900 dark:text-gray-100" },
            { label: "Checkout Sent", value: items.filter((i) => i.status === "checkout_sent").length, color: "text-amber-600 dark:text-amber-400" },
            { label: "Paid",          value: items.filter((i) => i.status === "paid").length,          color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Passed / Cancelled", value: items.filter((i) => i.status === "passed" || i.status === "cancelled").length, color: "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {["Code", "Title / Size", "Price", "Min", "Status", "Buyer", "Product", "Checkout Expires", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {items.map((item) => (
                  <Fragment key={item.id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                      editingItem === item.id ? "bg-blue-50/30 dark:bg-blue-900/10" :
                      item.status === "checkout_sent" ? "bg-amber-50/30 dark:bg-amber-900/10" :
                      item.status === "paid" ? "bg-emerald-50/20 dark:bg-emerald-900/10" : ""
                    }`}
                  >
                    {(true) && (
                      <>
                        <td className="pl-4 pr-3 py-2 font-mono font-bold text-gray-900 dark:text-gray-100">{item.code}</td>
                        <td className="px-3 py-2 max-w-[180px]">
                          <p className="truncate text-gray-800 dark:text-gray-200 font-medium">{item.title_snapshot}</p>
                          {item.size && <p className="text-gray-400 text-xs">Size: {item.size}</p>}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{$$(item.price)}</td>
                        <td className="px-3 py-2 tabular-nums text-gray-400">{$$(item.minimum_price)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status] ?? STATUS_COLORS.available}`}>
                            {item.status.replace("_", " ")}
                          </span>
                          {item.checkout_price && item.status === "checkout_sent" && (
                            <p className="text-xs text-amber-600 mt-0.5">{$$(item.checkout_price)}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          {item.buyer_handle ? (
                            <span>@{item.buyer_handle}{item.buyer_platform ? ` (${item.buyer_platform})` : ""}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {item.product ? (
                            item.product.slug && item.product.public_id ? (
                              <a href={`/products/${item.product.slug}-${item.product.public_id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline truncate block max-w-[120px]">
                                {item.product.name}
                              </a>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400 truncate block max-w-[120px]" title="Product has no URL (draft/legacy)">{item.product.name}</span>
                            )
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {item.checkout_expires_at ? (
                            <span className={new Date(item.checkout_expires_at) < new Date() ? "text-red-500" : ""}>
                              {new Date(item.checkout_expires_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="pr-4 pl-3 py-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.status === "available" && (
                              <>
                                <button onClick={() => openClaimModal(item)}
                                  className="px-2 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors">
                                  Claim
                                </button>
                              </>
                            )}
                            {item.status === "checkout_sent" && (
                              <>
                                <button onClick={() => navigator.clipboard.writeText(buildDMMessage(item))}
                                  className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                  Copy DM
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(`${SITE_URL}/livestream-checkout/${item.checkout_token}`)}
                                  className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                  Copy Link
                                </button>
                                <button onClick={() => handleRelease(item)}
                                  className="px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                  Release
                                </button>
                                {item.checkout_url && (
                                  <a href={item.checkout_url} target="_blank" rel="noopener noreferrer"
                                    className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    Checkout Link
                                  </a>
                                )}
                              </>
                            )}
                            <button onClick={() => startEdit(item)}
                              className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              Edit
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Inline edit expansion row */}
                  {editingItem === item.id && (
                    <tr key={`${item.id}-edit`} className="bg-blue-50/30 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex flex-wrap gap-3 items-end">
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Title</label>
                            <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Item title" />
                          </div>
                          <div className="w-28">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Size</label>
                            <input className={inputCls} value={editSize} onChange={(e) => setEditSize(e.target.value)} placeholder="e.g. 54mm" />
                          </div>
                          <div className="w-24">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Price (USD)</label>
                            <input type="number" className={inputCls} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="0.00" step="0.01" min="0" />
                          </div>
                          <div className="w-24">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Min Price</label>
                            <input type="number" className={inputCls} value={editMinPrice} onChange={(e) => setEditMinPrice(e.target.value)} placeholder="—" step="0.01" min="0" />
                          </div>
                          {item.status === "checkout_sent" && (
                            <div className="w-28">
                              <label className="block text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wide">Checkout Price</label>
                              <input type="number" className={inputCls} value={editCheckoutPrice} onChange={(e) => setEditCheckoutPrice(e.target.value)} placeholder="0.00" step="0.01" min="0.01" />
                            </div>
                          )}
                          <div className="flex-1 min-w-[220px]">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Link Product (Ship Now only)</label>
                            <ProductSearch
                              value={editProductId ? { id: editProductId, name: editProductName } : null}
                              onSelect={(p) => {
                                setEditProductId(p?.id ?? "");
                                setEditProductName(p?.name ?? "");
                              }}
                            />
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => saveItemEdit(item)} disabled={saving}
                              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                              Save
                            </button>
                            <button onClick={() => setEditingItem(null)}
                              className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Claim Modal */}
      {claimItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg p-6">
            {claimResult ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Checkout Link Sent!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Copy the DM below to send to the buyer.</p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono border border-gray-200 dark:border-gray-700 mb-4">
                  {claimResult.dmMessage}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(claimResult.dmMessage)}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
                  >
                    Copy DM
                  </button>
                  <button onClick={closeClaimModal}
                    className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Claim {claimItem.code} — {claimItem.title_snapshot}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Asking price: {$$(claimItem.price)}{claimItem.size ? ` · Size: ${claimItem.size}` : ""}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buyer Handle <span className="text-red-400">*</span></label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 text-sm">@</span>
                      <input
                        className="flex-1 text-sm border border-gray-300 dark:border-gray-700 rounded-r-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={buyerHandle}
                        onChange={(e) => setBuyerHandle(e.target.value.replace(/^@/, ""))}
                        placeholder="username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
                      <select
                        className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        value={buyerPlatform}
                        onChange={(e) => setBuyerPlatform(e.target.value)}
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checkout Price (USD)</label>
                      <input
                        type="number"
                        className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={checkoutPrice}
                        onChange={(e) => setCheckoutPrice(e.target.value)}
                        placeholder={String(claimItem.price)}
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  {checkoutPrice && parseFloat(checkoutPrice) !== claimItem.price && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price Override Reason</label>
                      <input
                        className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        value={priceNote}
                        onChange={(e) => setPriceNote(e.target.value)}
                        placeholder="e.g. negotiated, bundle deal, etc."
                      />
                    </div>
                  )}

                  {msg && <p className="text-sm text-red-500">{msg}</p>}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleClaim}
                    disabled={claiming || !buyerHandle.trim()}
                    className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {claiming ? "Sending checkout…" : "Send Checkout Link"}
                  </button>
                  <button
                    onClick={closeClaimModal}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
