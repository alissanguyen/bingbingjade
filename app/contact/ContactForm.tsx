"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import emailjs from "@emailjs/browser";

type Status = "idle" | "sending" | "success" | "error";

interface ProductOption {
  id: string;
  name: string;
  category: string;
  status: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  public_id: string;
  images: string[];
}

function formatPrice(p: ProductOption): string {
  if (p.status === "on_sale" && p.sale_price_usd != null) return `$${p.sale_price_usd.toFixed(2)} (on sale from $${p.price_display_usd?.toFixed(2)})`;
  if (p.price_display_usd != null) return `$${p.price_display_usd.toFixed(2)}`;
  return "Contact for price";
}

function statusLabel(s: string) {
  if (s === "sold") return " · Sold";
  if (s === "on_sale") return " · On Sale";
  return "";
}

function ProductCard({ p, onRemove }: { p: ProductOption; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
      <div className="flex items-stretch">
        {p.images?.[0] ? (
          <div className="relative w-16 shrink-0">
            <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="64px" />
          </div>
        ) : (
          <div className="w-16 shrink-0 bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-xl">🪨</div>
        )}
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {p.category}
                {p.status === "sold" && <span className="ml-1.5 rounded-full bg-red-100 dark:bg-red-950/50 px-1.5 py-0.5 text-red-600 dark:text-red-400 normal-case tracking-normal">Sold</span>}
                {p.status === "on_sale" && <span className="ml-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-amber-600 dark:text-amber-400 normal-case tracking-normal">On Sale</span>}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-1">{p.name}</p>
              <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {p.status === "on_sale" && p.sale_price_usd != null ? (
                  <>
                    <span>${p.sale_price_usd.toFixed(2)}</span>
                    {p.price_display_usd != null && <span className="ml-1.5 text-xs text-gray-400 line-through">${p.price_display_usd.toFixed(2)}</span>}
                  </>
                ) : p.price_display_usd != null ? (
                  `$${p.price_display_usd.toFixed(2)}`
                ) : (
                  "Contact for price"
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
              aria-label="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactForm({
  products = [],
  preselectedProductId,
}: {
  products?: ProductOption[];
  preselectedProductId?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [fields, setFields] = useState({ from_name: "", from_email: "", message: "" });

  const preselected = preselectedProductId ? products.find((p) => p.public_id === preselectedProductId) : null;
  const [selectedIds, setSelectedIds] = useState<string[]>(preselected ? [preselected.id] : []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const selectedProducts = selectedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ProductOption[];

  const filtered = (query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products
  ).filter((p) => !selectedIds.includes(p.id));

  function addProduct(p: ProductOption) {
    setSelectedIds((ids) => [...ids, p.id]);
    setQuery("");
  }

  function removeProduct(id: string) {
    setSelectedIds((ids) => ids.filter((i) => i !== id));
  }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { from_name, from_email, message } = fields;
    if (!from_name.trim() || !from_email.trim() || !message.trim()) return;

    setStatus("sending");
    try {
      const opts = { publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY! };
      const params = {
        from_name,
        from_email,
        message,
        product_name: selectedProducts.length > 0 ? selectedProducts.map((p) => p.name).join(", ") : "N/A",
        product_id: selectedProducts.length > 0 ? selectedProducts.map((p) => p.id).join(", ") : "N/A",
        product_category: selectedProducts.length > 0 ? selectedProducts.map((p) => p.category).join(", ") : "N/A",
        product_price: selectedProducts.length > 0 ? selectedProducts.map((p) => formatPrice(p)).join(", ") : "N/A",
        product_status: selectedProducts.length > 0 ? selectedProducts.map((p) => p.status).join(", ") : "N/A",
      };

      await Promise.all([
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!, params, opts),
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID!, params, opts),
      ]);
      setStatus("success");
      setFields({ from_name: "", from_email: "", message: "" });
      setSelectedIds([]);
      setQuery("");
    } catch (err) {
      console.error("EmailJS error:", err);
      setStatus("error");
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product search combobox */}
      {products.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Inquiring about <span className="text-gray-400 font-normal">(optional)</span>
          </label>

          <div ref={comboRef} className="relative mt-1">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Search and add products…"
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 pr-9 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setOpen(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              )}
            </div>

            {open && filtered.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg text-sm">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addProduct(p); setOpen(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-3"
                    >
                      <span className="text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{p.category}{statusLabel(p.status)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {open && query.trim() && filtered.length === 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-4 py-3 text-sm text-gray-400 dark:text-gray-500">
                No products found.
              </div>
            )}
          </div>

          {/* Selected product cards */}
          {selectedProducts.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {selectedProducts.map((p) => (
                <ProductCard key={p.id} p={p} onRemove={() => removeProduct(p.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="from_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input id="from_name" name="from_name" type="text" required placeholder="Your name" value={fields.from_name} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
        <input id="from_email" name="from_email" type="email" required placeholder="you@example.com" value={fields.from_email} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
        <textarea id="message" name="message" rows={5} required placeholder="How can we help you?" value={fields.message} onChange={handleChange} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={status === "sending" || status === "success"}
        className="w-full rounded-full bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Sending…" : status === "success" ? "Message Sent!" : "Send Message"}
      </button>

      {status === "success" && (
        <p className="text-sm text-center text-emerald-600 dark:text-emerald-400">
          Thank you! We&apos;ll get back to you as soon as possible.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-center text-red-500 dark:text-red-400">
          Something went wrong. Please try again or reach out via WhatsApp or Instagram.
        </p>
      )}
    </form>
  );
}
