"use client";

import { useState, useCallback, useEffect } from "react";
import type { Livestream, LivestreamItem } from "@/types/livestream";

type ItemWithProduct = LivestreamItem & {
  product?: { id: string; name: string; status: string } | null;
};

interface Props {
  livestream: Livestream;
  initialItems: ItemWithProduct[];
}

const STATUS_BADGE: Record<string, string> = {
  available:     "bg-gray-100 text-gray-600",
  checkout_sent: "bg-amber-100 text-amber-700",
  paid:          "bg-emerald-100 text-emerald-700",
  passed:        "bg-slate-100 text-slate-500",
  cancelled:     "bg-red-100 text-red-500",
};

function $$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

function buildDMMessage(item: ItemWithProduct): string {
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
    "💛 Just a gentle heads-up: if someone else is waiting in line for this piece, we can hold it for you for 15 minutes. If payment isn't completed by then, we'll kindly release it to the next person so everyone gets a fair chance. Thank you so much for understanding!",
    "",
    `⏰ Link expires ${expireStr}. Payment locks in your order — no need to DM us once paid!`,
    "",
    "Questions? Just reply here. Thank you for shopping with BingBing Jade! 💚",
  ].join("\n");
}

export function LiveModeClient({ livestream, initialItems }: Props) {
  const [items, setItems] = useState<ItemWithProduct[]>(initialItems);
  const [claimItem, setClaimItem] = useState<ItemWithProduct | null>(null);
  const [buyerHandle, setBuyerHandle] = useState("");
  const [buyerPlatform, setBuyerPlatform] = useState("instagram");
  const [checkoutPrice, setCheckoutPrice] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [dmMessage, setDmMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add an unplanned item mid-stream
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/livestreams/${livestream.id}`);
    const json = await res.json();
    if (json.items) setItems(json.items);
  }, [livestream.id]);

  // Auto-refresh every 30s during live
  useEffect(() => {
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload]);

  function openClaim(item: ItemWithProduct) {
    setClaimItem(item);
    setBuyerHandle("");
    setBuyerPlatform("instagram");
    setCheckoutPrice(item.price ? String(item.price) : "");
    setDmMessage(null);
    setError(null);
  }

  function openAdd() {
    setNewTitle("");
    setNewSize("");
    setNewPrice("");
    setAddError(null);
    setShowAdd(true);
  }

  // Creates the item, then jumps straight into claiming it for the buyer
  async function handleAddItem() {
    setAddingItem(true);
    setAddError(null);
    const res = await fetch(`/api/admin/livestreams/${livestream.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: 1,
        title: newTitle.trim() || undefined,
        size: newSize.trim() || undefined,
        price: newPrice ? parseFloat(newPrice) : 0,
      }),
    });
    const json = await res.json();
    setAddingItem(false);
    if (!res.ok) { setAddError(json.error); return; }
    setShowAdd(false);
    await reload();
    if (json.items?.[0]) openClaim(json.items[0]);
  }

  async function handleClaim() {
    if (!claimItem) return;
    setClaiming(true);
    setError(null);
    const res = await fetch(`/api/admin/livestreams/${livestream.id}/items/${claimItem.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_handle: buyerHandle.trim(),
        buyer_platform: buyerPlatform,
        checkout_price: checkoutPrice ? parseFloat(checkoutPrice) : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setClaiming(false); return; }
    setDmMessage(json.dmMessage);
    await reload();
    setClaiming(false);
  }

  async function handleRelease(item: ItemWithProduct) {
    const res = await fetch(`/api/admin/livestreams/${livestream.id}/items/${item.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Released via live mode" }),
    });
    if (res.ok) await reload();
  }

  const availableItems = items.filter((i) => i.status === "available");
  const activeItems = items.filter((i) => i.status === "checkout_sent");
  const doneItems = items.filter((i) => i.status === "paid" || i.status === "passed" || i.status === "cancelled");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Compact header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{livestream.platform}</p>
          <h1 className="text-sm font-semibold truncate max-w-[200px]">{livestream.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="text-emerald-400 font-medium">{availableItems.length} left</span>
          <span className="text-amber-400">{activeItems.length} pending</span>
          <span className="text-gray-500">{doneItems.filter((i) => i.status === "paid").length} sold</span>
          <a href={`/livestreams-admin/${livestream.id}`} className="text-gray-400 hover:text-gray-200 text-xs ml-2">← Full View</a>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">

        {/* Active (checkout sent) — show first for quick access */}
        {activeItems.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Checkout Sent ({activeItems.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeItems.map((item) => (
                <div key={item.id} className="bg-gray-900 border border-amber-900/50 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-amber-400 text-sm">{item.code}</span>
                      <p className="text-sm font-medium text-gray-100 mt-0.5">{item.title_snapshot}</p>
                      {item.size && <p className="text-xs text-gray-500">Size: {item.size}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-400">{$$(item.checkout_price ?? item.price)}</p>
                      {item.buyer_handle && <p className="text-xs text-gray-400">@{item.buyer_handle}</p>}
                    </div>
                  </div>
                  {item.checkout_expires_at && (
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(item.checkout_expires_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(buildDMMessage(item))}
                      className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                    >
                      Copy DM
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${SITE_URL}/livestream-checkout/${item.checkout_token}`)}
                      className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => handleRelease(item)}
                      className="px-2 py-1 text-xs bg-red-900/30 border border-red-800/50 text-red-400 rounded hover:bg-red-900/60 transition-colors"
                    >
                      Release
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available items grid */}
        {(availableItems.length > 0 || livestream.status !== "ended") && (
          <div className="mb-4">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Available ({availableItems.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {availableItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openClaim(item)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-left hover:border-emerald-700 hover:bg-gray-800 transition-colors active:scale-95"
                >
                  <span className="font-mono font-bold text-emerald-400 text-base">{item.code}</span>
                  <p className="text-xs text-gray-300 mt-1 line-clamp-2">{item.title_snapshot}</p>
                  {item.size && <p className="text-xs text-gray-500 mt-0.5">{item.size}</p>}
                  <p className="text-sm font-semibold text-gray-100 mt-1">{$$(item.price)}</p>
                </button>
              ))}
              {livestream.status !== "ended" && (
                <button
                  onClick={openAdd}
                  className="border border-dashed border-gray-700 rounded-xl p-3 text-center text-sm text-gray-400 hover:border-emerald-700 hover:text-emerald-400 transition-colors active:scale-95"
                >
                  + New Item
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sold / done */}
        {doneItems.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Done ({doneItems.length})</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {doneItems.map((item) => (
                <div key={item.id} className={`rounded-lg px-2 py-1.5 text-center ${STATUS_BADGE[item.status] ?? ""}`}>
                  <p className="font-mono font-bold text-xs">{item.code}</p>
                  <p className="text-xs mt-0.5 truncate">{item.status === "paid" ? "SOLD" : item.status.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add item modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-gray-100 mb-4">New Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title (buyer sees this at checkout)</label>
                <input
                  className="w-full text-sm border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Icy Lavender Bangle"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Size</label>
                  <input
                    className="w-full text-sm border border-gray-700 rounded-lg px-2 py-2 bg-gray-800 text-gray-100"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    placeholder="e.g. 54mm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Price (USD)</label>
                  <input
                    type="number"
                    className="w-full text-sm border border-gray-700 rounded-lg px-2 py-2 bg-gray-800 text-gray-100"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddItem}
                disabled={addingItem}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {addingItem ? "Adding…" : "Add & Claim"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 text-sm border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim modal */}
      {claimItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5">
            {dmMessage ? (
              <>
                <h3 className="text-base font-semibold text-gray-100 mb-1">Ready to DM!</h3>
                <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300 whitespace-pre-wrap font-mono mb-4 max-h-48 overflow-y-auto">
                  {dmMessage}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(dmMessage)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-900 rounded-xl hover:bg-white transition-colors"
                  >
                    Copy DM
                  </button>
                  <button
                    onClick={() => setClaimItem(null)}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="font-mono font-bold text-emerald-400 text-lg">{claimItem.code}</span>
                    <p className="text-sm text-gray-300 mt-0.5">{claimItem.title_snapshot}</p>
                    <p className="text-xs text-gray-500">{claimItem.size ?? ""}</p>
                  </div>
                  <p className="text-lg font-bold text-gray-100">{$$(claimItem.price)}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Buyer Handle</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-gray-700 bg-gray-800 text-gray-500 text-sm">@</span>
                      <input
                        className="flex-1 text-sm border border-gray-700 rounded-r-lg px-3 py-2 bg-gray-800 text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={buyerHandle}
                        onChange={(e) => setBuyerHandle(e.target.value.replace(/^@/, ""))}
                        placeholder="username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Platform</label>
                      <select
                        className="w-full text-sm border border-gray-700 rounded-lg px-2 py-2 bg-gray-800 text-gray-100"
                        value={buyerPlatform}
                        onChange={(e) => setBuyerPlatform(e.target.value)}
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Price (USD)</label>
                      <input
                        type="number"
                        className="w-full text-sm border border-gray-700 rounded-lg px-2 py-2 bg-gray-800 text-gray-100"
                        value={checkoutPrice}
                        onChange={(e) => setCheckoutPrice(e.target.value)}
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleClaim}
                    disabled={claiming || !buyerHandle.trim()}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-colors"
                  >
                    {claiming ? "Sending…" : "Send Checkout"}
                  </button>
                  <button
                    onClick={() => setClaimItem(null)}
                    className="px-4 py-2.5 text-sm border border-gray-700 text-gray-400 rounded-xl hover:bg-gray-800 transition-colors"
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
