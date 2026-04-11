"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { SubscriberPicker } from "../SubscriberPicker";

export type { PickerSubscriber } from "../SubscriberPicker";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  category: string | null;
  postUrl: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function NewBlogClient({
  posts,
  subscribers,
  subscriberCount,
}: {
  posts: BlogPost[];
  subscribers: import("../SubscriberPicker").PickerSubscriber[];
  subscriberCount: number;
}) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(posts[0]?.id ?? null);
  const [subject, setSubject] = useState(posts[0] ? `BingBing Educational Blog — ${posts[0].title}` : "");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

  function selectPost(p: BlogPost) {
    setSelectedPostId(p.id);
    setSubject(`BingBing Educational Blog — ${p.title}`);
  }

  function validate() {
    if (!selectedPost) { setError("Select a blog post."); return false; }
    if (!subject.trim()) { setError("Subject is required."); return false; }
    if (targetMode === "selected" && selectedEmails.size === 0) { setError("Select at least one subscriber."); return false; }
    setError(null);
    return true;
  }

  function buildBody() {
    return {
      subject: subject.trim(),
      postTitle: selectedPost!.title,
      postExcerpt: selectedPost!.excerpt ?? undefined,
      postImageUrl: selectedPost!.imageUrl ?? undefined,
      postSlug: selectedPost!.slug,
      targetEmails: targetMode === "selected" ? [...selectedEmails] : null,
    };
  }

  async function handlePreview() {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/emails/new-blog?preview=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
      else setError(data.error ?? "Preview failed.");
    } finally { setPreviewing(false); }
  }

  async function handleSend() {
    if (!validate()) return;
    const recipientLabel = targetMode === "all"
      ? `${subscriberCount} subscriber${subscriberCount !== 1 ? "s" : ""}`
      : `${selectedEmails.size} selected`;
    if (!confirm(`Send blog email to ${recipientLabel}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/new-blog", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error ?? "Send failed.");
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/custom-emails-admin" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Custom Emails
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">New Blog</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Share a blog post with your subscribers.</p>

      <div className="space-y-6">
        {/* Blog picker */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Select Post</h2>
          {posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No blog posts found.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {posts.map((p) => {
                const isSelected = selectedPostId === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => selectPost(p)}
                    className={`w-full flex items-center gap-4 rounded-xl border p-3 text-left transition-all ${isSelected ? "border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-900/10" : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"}`}>
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                      {p.imageUrl
                        ? <Image src={p.imageUrl} alt={p.title} fill unoptimized className="object-cover" sizes="64px" />
                        : <div className="w-full h-full flex items-center justify-center text-xl">📰</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {p.category && <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-0.5">{p.category}</p>}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{p.title}</p>
                      {p.publishedAt && <p className="text-xs text-gray-400 mt-0.5">{fmt(p.publishedAt)}</p>}
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Subject */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Email Details</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
        </section>

        {/* Recipients */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Recipients</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} className="accent-sky-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">All subscribers <span className="text-gray-400">({subscriberCount.toLocaleString()})</span></span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "selected"} onChange={() => setTargetMode("selected")} className="accent-sky-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Select specific subscribers</span>
            </label>
            {targetMode === "selected" && (
              <div className="mt-2">
                <SubscriberPicker subscribers={subscribers} selected={selectedEmails} onChange={setSelectedEmails} />
              </div>
            )}
          </div>
        </section>

        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.{result.failed > 0 ? ` ${result.failed} failed.` : ""}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing || !selectedPost}
            className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-sky-400 hover:text-sky-700 dark:hover:text-sky-400 transition-colors disabled:opacity-50">
            {previewing ? "Loading…" : "Preview Email"}
          </button>
          <button type="button" onClick={handleSend} disabled={sending || !selectedPost}
            className="flex-1 rounded-full bg-sky-600 hover:bg-sky-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? "Sending…" : `Send${targetMode === "all" ? ` to ${subscriberCount.toLocaleString()} subscribers` : ` to ${selectedEmails.size} selected`}`}
          </button>
        </div>
      </div>

      {previewHtml && <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </div>
  );
}
