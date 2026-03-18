"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import emailjs from "@emailjs/browser";

type Status = "idle" | "sending" | "success" | "error";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductOption {
  id: string;        // internal UUID — used only for React keys, never sent to EmailJS
  name: string;
  category: string;
  status: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  public_id: string; // public-facing identifier used in URLs and email params
  slug?: string;     // URL slug prefix — present on new products, may be absent on legacy
  images: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strip trailing slash so concatenation is always clean
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function formatPrice(p: ProductOption): string {
  if (p.status === "on_sale" && p.sale_price_usd != null) {
    const sale = `$${p.sale_price_usd.toFixed(2)}`;
    const original = p.price_display_usd != null ? ` (was $${p.price_display_usd.toFixed(2)})` : "";
    return `${sale}${original}`;
  }
  if (p.price_display_usd != null) return `$${p.price_display_usd.toFixed(2)}`;
  return "Contact for price";
}

function formatStatusLabel(s: string): string {
  if (s === "sold") return "Sold";
  if (s === "on_sale") return "On Sale";
  return "Available";
}

/** Builds the canonical public product URL.
 *  Uses slug when present (new products), falls back to public_id only (legacy). */
function buildProductUrl(p: ProductOption): string {
  const path = p.slug
    ? `/products/${p.slug}-${p.public_id}`
    : `/products/${p.public_id}`;
  return SITE_URL ? `${SITE_URL}${path}` : path;
}

function getFirstImageUrl(p: ProductOption): string {
  return p.images?.[0] ?? "";
}

/** Maps an array of products to a comma-separated string. Falls back to `fallback` if empty. */
function joinField(products: ProductOption[], fn: (p: ProductOption) => string, fallback = "N/A"): string {
  if (products.length === 0) return fallback;
  return products.map(fn).join(", ");
}

// ─── EmailJS payload ──────────────────────────────────────────────────────────

interface EmailParams extends Record<string, unknown> {
  from_name: string;
  from_email: string;
  message: string;
  inquiry_type: "Product inquiry" | "General inquiry";
  // Aggregate — all selected products, comma-separated
  product_names: string;
  product_public_ids: string;
  product_categories: string;
  product_prices: string;
  product_statuses: string;
  product_urls: string;
  product_image_urls: string;
  // Primary — first selected product (use for featured card in email template)
  primary_product_name: string;
  primary_product_public_id: string;
  primary_product_category: string;
  primary_product_price: string;
  primary_product_status: string;
  primary_product_url: string;
  primary_product_image_url: string;
  // Meta
  product_count: string;
  has_multiple_products: "yes" | "no";
}

function buildEmailParams(
  fields: { from_name: string; from_email: string; message: string },
  selectedProducts: ProductOption[],
): EmailParams {
  const hasProducts = selectedProducts.length > 0;
  const primary = hasProducts ? selectedProducts[0] : null;

  return {
    from_name: fields.from_name,
    from_email: fields.from_email,
    message: fields.message,
    inquiry_type: hasProducts ? "Product inquiry" : "General inquiry",
    // Aggregate
    product_names:      joinField(selectedProducts, (p) => p.name),
    product_public_ids: joinField(selectedProducts, (p) => p.public_id),
    product_categories: joinField(selectedProducts, (p) => p.category),
    product_prices:     joinField(selectedProducts, (p) => formatPrice(p)),
    product_statuses:   joinField(selectedProducts, (p) => formatStatusLabel(p.status)),
    product_urls:       joinField(selectedProducts, (p) => buildProductUrl(p)),
    product_image_urls: joinField(selectedProducts, (p) => getFirstImageUrl(p), ""),
    // Primary
    primary_product_name:      primary?.name ?? "",
    primary_product_public_id: primary?.public_id ?? "",
    primary_product_category:  primary?.category ?? "",
    primary_product_price:     primary ? formatPrice(primary) : "",
    primary_product_status:    primary ? formatStatusLabel(primary.status) : "",
    primary_product_url:       primary ? buildProductUrl(primary) : "",
    primary_product_image_url: primary ? getFirstImageUrl(primary) : "",
    // Meta
    product_count:         String(selectedProducts.length),
    has_multiple_products: selectedProducts.length > 1 ? "yes" : "no",
  };
}

// ─── ProductCard UI ───────────────────────────────────────────────────────────

function statusBadge(s: string) {
  if (s === "sold") return <span className="ml-1.5 rounded-full bg-red-100 dark:bg-red-950/50 px-1.5 py-0.5 text-red-600 dark:text-red-400 normal-case tracking-normal">Sold</span>;
  if (s === "on_sale") return <span className="ml-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-amber-600 dark:text-amber-400 normal-case tracking-normal">On Sale</span>;
  return null;
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
                {p.category}{statusBadge(p.status)}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-1">{p.name}</p>
              <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {p.status === "on_sale" && p.sale_price_usd != null ? (
                  <>
                    <span>${p.sale_price_usd.toFixed(2)}</span>
                    {p.price_display_usd != null && (
                      <span className="ml-1.5 text-xs text-gray-400 line-through">${p.price_display_usd.toFixed(2)}</span>
                    )}
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

// ─── ContactForm ──────────────────────────────────────────────────────────────

export function ContactForm({
  products = [],
  preselectedProductId,
}: {
  products?: ProductOption[];
  preselectedProductId?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [fields, setFields] = useState({ from_name: "", from_email: "", message: "" });

  // Use public_id as the selection key — never exposes internal UUIDs
  const preselected = preselectedProductId
    ? products.find((p) => p.public_id === preselectedProductId)
    : null;
  const [selectedPublicIds, setSelectedPublicIds] = useState<string[]>(
    preselected ? [preselected.public_id] : [],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const selectedProducts = selectedPublicIds
    .map((pid) => products.find((p) => p.public_id === pid))
    .filter(Boolean) as ProductOption[];

  const filtered = (query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products
  ).filter((p) => !selectedPublicIds.includes(p.public_id));

  function addProduct(p: ProductOption) {
    setSelectedPublicIds((ids) => [...ids, p.public_id]);
    setQuery("");
    setOpen(false);
  }

  function removeProduct(publicId: string) {
    setSelectedPublicIds((ids) => ids.filter((id) => id !== publicId));
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
      const params = buildEmailParams(fields, selectedProducts);

      await Promise.all([
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!, params, opts),
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID!, params, opts),
      ]);

      setStatus("success");
      // Reset the form fully after a successful send.
      // We clear the preselected product too — the message was sent, so a clean
      // slate is the right UX. If the user wants to send another message about
      // the same product they can easily re-select it or navigate back.
      setFields({ from_name: "", from_email: "", message: "" });
      setSelectedPublicIds([]);
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
                  <li key={p.public_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addProduct(p); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-3"
                    >
                      <span className="text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {p.category}
                        {p.status === "sold" && " · Sold"}
                        {p.status === "on_sale" && " · On Sale"}
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

          {selectedProducts.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {selectedProducts.map((p) => (
                <ProductCard key={p.public_id} p={p} onRemove={() => removeProduct(p.public_id)} />
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
