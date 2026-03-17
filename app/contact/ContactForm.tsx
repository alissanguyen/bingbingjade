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

export function ContactForm({
  products = [],
  preselectedProductId,
}: {
  products?: ProductOption[];
  preselectedProductId?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [fields, setFields] = useState({
    from_name: "",
    from_email: "",
    message: "",
    product_id: preselectedProductId ?? "",
  });

  const preselected = preselectedProductId ? products.find((p) => p.public_id === preselectedProductId) : null;
  const [query, setQuery] = useState(preselected?.name ?? "");
  const [open, setOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  const selectedProduct = products.find((p) => p.id === fields.product_id) ?? null;

  function selectProduct(p: ProductOption) {
    setFields((f) => ({ ...f, product_id: p.id }));
    setQuery(p.name);
    setOpen(false);
  }

  function clearProduct() {
    setFields((f) => ({ ...f, product_id: "" }));
    setQuery("");
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing was selected, clear the query
        if (!fields.product_id) setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [fields.product_id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { from_name, from_email, message, product_id } = fields;
    if (!from_name.trim() || !from_email.trim() || !message.trim()) return;

    const chosen = products.find((p) => p.id === product_id) ?? null;

    setStatus("sending");
    try {
      const opts = { publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY! };
      const params = {
        from_name,
        from_email,
        message,
        product_name: chosen?.name ?? "N/A",
        product_id: chosen?.id ?? "N/A",
        product_category: chosen?.category ?? "N/A",
        product_price: chosen ? formatPrice(chosen) : "N/A",
        product_status: chosen?.status ?? "N/A",
      };

      await Promise.all([
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!, params, opts),
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID!, params, opts),
      ]);
      setStatus("success");
      setFields({ from_name: "", from_email: "", message: "", product_id: "" });
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  if (!e.target.value) setFields((f) => ({ ...f, product_id: "" }));
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search products…"
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 pr-9 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearProduct}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown */}
            {open && filtered.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg text-sm">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-3"
                    >
                      <span className="text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {p.category}{statusLabel(p.status)}
                      </span>
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

          {/* Selected product card */}
          {selectedProduct && (
            <div className="mt-3 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
              <div className="flex items-stretch gap-0">
                {/* Thumbnail */}
                {selectedProduct.images?.[0] ? (
                  <div className="relative w-20 shrink-0">
                    <Image
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                ) : (
                  <div className="w-20 shrink-0 bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-2xl">
                    🪨
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {selectedProduct.category}
                        {selectedProduct.status === "sold" && (
                          <span className="ml-2 rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-red-600 dark:text-red-400 normal-case tracking-normal">Sold</span>
                        )}
                        {selectedProduct.status === "on_sale" && (
                          <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-amber-600 dark:text-amber-400 normal-case tracking-normal">On Sale</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                        {selectedProduct.name}
                      </p>
                      <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {selectedProduct.status === "on_sale" && selectedProduct.sale_price_usd != null ? (
                          <>
                            <span>${selectedProduct.sale_price_usd.toFixed(2)}</span>
                            {selectedProduct.price_display_usd != null && (
                              <span className="ml-2 text-xs text-gray-400 line-through">${selectedProduct.price_display_usd.toFixed(2)}</span>
                            )}
                          </>
                        ) : selectedProduct.price_display_usd != null ? (
                          `$${selectedProduct.price_display_usd.toFixed(2)}`
                        ) : (
                          "Contact for price"
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearProduct}
                      className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
                      aria-label="Remove selection"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="from_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input
          id="from_name"
          name="from_name"
          type="text"
          required
          placeholder="Your name"
          value={fields.from_name}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
        <input
          id="from_email"
          name="from_email"
          type="email"
          required
          placeholder="you@example.com"
          value={fields.from_email}
          onChange={handleChange}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="How can we help you?"
          value={fields.message}
          onChange={handleChange}
          className={inputClass}
        />
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
