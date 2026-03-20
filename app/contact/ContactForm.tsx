"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import emailjs from "@emailjs/browser";
import { buildWhatsAppLink } from "@/lib/whatsapp";

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

// Strip trailing slash so concatenation is always clean.
// Falls back to the production domain so email links are always absolute.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

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

/**
 * Returns the first image URL for a product.
 * REQUIREMENT: p.images[0] must already be a fully resolved, publicly accessible
 * URL (https://...) — not a raw storage path like "wm/abc.jpg".
 * The contact page resolves signed URLs server-side before passing products here.
 * If that upstream resolution is skipped, email image cards will be broken.
 */
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
  // Aliases for EmailJS default templates that use {{name}} / {{email}}
  name: string;
  email: string;
  // Explicit fields used by custom templates
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
    name: fields.from_name,
    email: fields.from_email,
    from_name: fields.from_name,
    from_email: fields.from_email,
    message: fields.message,
    inquiry_type: hasProducts ? "Product inquiry" : "General inquiry",
    // Aggregate — empty string when no products selected (avoids "N/A" in email templates)
    product_names:      joinField(selectedProducts, (p) => p.name, ""),
    product_public_ids: joinField(selectedProducts, (p) => p.public_id, ""),
    product_categories: joinField(selectedProducts, (p) => p.category, ""),
    product_prices:     joinField(selectedProducts, (p) => formatPrice(p), ""),
    product_statuses:   joinField(selectedProducts, (p) => formatStatusLabel(p.status), ""),
    product_urls:       joinField(selectedProducts, (p) => buildProductUrl(p), ""),
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
      // Clear text fields and query after submit. If the page was opened with a
      // preselected product (e.g. from /contact?product=xxx), restore that
      // selection — the customer may want to follow up about the same piece.
      // Otherwise clear the selection entirely for a clean slate.
      setFields({ from_name: "", from_email: "", message: "" });
      setSelectedPublicIds(preselected ? [preselected.public_id] : []);
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

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={status === "sending" || status === "success"}
          className="w-full rounded-full bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "Sending…" : status === "success" ? "Message Sent!" : "Send Message"}
        </button>
        <a
          href={buildWhatsAppLink(selectedProducts)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-full border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 py-3 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/60 hover:border-green-400 dark:hover:border-green-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          {selectedProducts.length > 0 ? "Ask on WhatsApp" : "Chat on WhatsApp"}
        </a>
      </div>

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
