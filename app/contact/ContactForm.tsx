"use client";

import { useState } from "react";
import emailjs from "@emailjs/browser";

type Status = "idle" | "sending" | "success" | "error";

interface ProductOption {
  id: string;
  name: string;
  category: string;
  status: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
}

function formatPrice(p: ProductOption): string {
  if (p.status === "on_sale" && p.sale_price_usd != null) return `$${p.sale_price_usd.toFixed(2)} (on sale from $${p.price_display_usd?.toFixed(2)})`;
  if (p.price_display_usd != null) return `$${p.price_display_usd.toFixed(2)}`;
  return "Contact for price";
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { from_name, from_email, message, product_id } = fields;
    if (!from_name.trim() || !from_email.trim() || !message.trim()) return;

    const selectedProduct = products.find((p) => p.id === product_id) ?? null;

    setStatus("sending");
    try {
      const opts = { publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY! };
      const params = {
        from_name,
        from_email,
        message,
        product_name: selectedProduct?.name ?? "N/A",
        product_id: selectedProduct?.id ?? "N/A",
        product_category: selectedProduct?.category ?? "N/A",
        product_price: selectedProduct ? formatPrice(selectedProduct) : "N/A",
        product_status: selectedProduct?.status ?? "N/A",
      };

      await Promise.all([
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!, params, opts),
        emailjs.send(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, process.env.NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID!, params, opts),
      ]);
      setStatus("success");
      setFields({ from_name: "", from_email: "", message: "", product_id: "" });
    } catch (err) {
      console.error("EmailJS error:", err);
      setStatus("error");
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const selectedProduct = products.find((p) => p.id === fields.product_id) ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Optional product selector */}
      {products.length > 0 && (
        <div>
          <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Inquiring about <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            id="product_id"
            name="product_id"
            value={fields.product_id}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— No specific product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.status === "sold" ? " (Sold)" : p.status === "on_sale" ? " (On Sale)" : ""}
              </option>
            ))}
          </select>

          {/* Selected product preview */}
          {selectedProduct && (
            <div className="mt-2 rounded-lg border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedProduct.category} · {formatPrice(selectedProduct)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFields((f) => ({ ...f, product_id: "" }))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs ml-3"
              >
                ✕
              </button>
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
