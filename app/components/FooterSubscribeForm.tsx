"use client";

import { useState } from "react";

export function FooterSubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "footer" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus(data.alreadySubscribed ? "already" : "success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not subscribe. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
        <svg className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">You&apos;re in!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Check your email for your welcome discount code.</p>
        </div>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-700 px-4 py-3">
        <svg className="mt-0.5 shrink-0 text-stone-400" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Already subscribed</p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">You&apos;re already on our list — we&apos;ll keep you posted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === "loading"}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors shrink-0"
        >
          {status === "loading" ? "…" : "Join"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
