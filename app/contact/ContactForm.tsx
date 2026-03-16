"use client";

import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;

    setStatus("sending");
    try {
      await emailjs.sendForm(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        formRef.current,
        { publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY! }
      );
      setStatus("success");
      formRef.current.reset();
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="from_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input
          id="from_name"
          name="from_name"
          type="text"
          required
          placeholder="Your name"
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
