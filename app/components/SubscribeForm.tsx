"use client";

import { useState } from "react";

interface Props {
  /** Compact variant for use in footers etc. */
  compact?: boolean;
}

export function SubscribeForm({ compact = false }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "website" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setMessage(
          data.alreadySubscribed
            ? "You're already on our list!"
            : "You're subscribed! Check your email for your welcome discount."
        );
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Could not subscribe. Please try again.");
    }
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-sm">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          required
          disabled={status === "loading" || status === "success"}
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors shrink-0"
        >
          {status === "loading" ? "…" : status === "success" ? "✓" : "Subscribe"}
        </button>
        {message && (
          <p className={`text-xs mt-1.5 ${status === "error" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
            {message}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-6 py-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
        Newsletter
      </p>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Get your first-order discount
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
        Subscribe and receive $10–$20 off your first order, plus updates on new pieces and restocks.
      </p>

      {status === "success" ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-700 text-white px-5 py-2.5 text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={status === "loading"}
            className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-medium transition-colors shrink-0"
          >
            {status === "loading" ? "Subscribing…" : "Get Discount"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="mt-2 text-xs text-red-500">{message}</p>
      )}

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        No spam. Unsubscribe anytime. Discount valid on first order only.
      </p>
    </div>
  );
}
