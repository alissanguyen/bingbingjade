"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://www.bingbingjade.com";

interface RewardsData {
  customerName: string;
  referralCode: string;
  availableBalance: number;
  totalEarned: number;
  totalUsed: number;
  successfulReferrals: number;
  pendingReferrals: number;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:underline transition-colors"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {label ?? "Copy"}
        </>
      )}
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Email form ────────────────────────────────────────────────────────────────
function EmailForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rewards/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        window.location.href = "/rewards?sent=1";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="rewards-email" className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Email Address
          </label>
          <input
            id="rewards-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 transition-shadow"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold py-3 transition-colors"
        >
          {loading ? "Sending…" : "Send My Rewards Link"}
        </button>
      </form>
      <p className="mt-6 text-xs text-center text-gray-400 dark:text-gray-500 leading-relaxed">
        We&rsquo;ll send a secure link to your email. No password required.
      </p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ data }: { data: RewardsData }) {
  const referralLink = `${SITE_URL}/?ref=${data.referralCode}`;
  const firstName = data.customerName?.split(" ")[0] ?? "there";

  return (
    <div className="w-full space-y-6">
      {/* Welcome */}
      <div className="text-center mb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, <span className="font-medium text-emerald-700 dark:text-emerald-300">{firstName}</span></p>
      </div>
      <p className="mt-8 text-base sm:text-lg italic font-medium text-emerald-900 dark:text-white max-w-lg mx-auto leading-relaxed tracking-wide">
        &ldquo;Because jade has always been something you share — with people you care about.&rdquo;
      </p>
      {/* Credit summary */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8">
        <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Store Credit</p>
        <div className="grid grid-cols-3 gap-4 divide-x divide-gray-100 dark:divide-gray-800">
          <Stat label="Available" value={`$${data.availableBalance.toFixed(2)}`} />
          <Stat label="Total Earned" value={`$${data.totalEarned.toFixed(2)}`} />
          <Stat label="Total Used" value={`$${data.totalUsed.toFixed(2)}`} />
        </div>
        {data.availableBalance > 0 && (
          <p className="mt-6 text-xs text-center text-emerald-700 dark:text-emerald-400">
            Your credit is applied automatically at checkout.
          </p>
        )}
      </div>

      {/* How referrals work */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8">
        <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-5">How It Works</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
          When someone you invite discovers BingBing Jade, they&rsquo;ll receive a private welcome offer.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
          As a thank you, you&rsquo;ll receive a credit toward your next piece — scaled to the piece they choose.
        </p>
        <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 text-sm">
          <div className="grid grid-cols-3 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-[10px] sm:text-[12px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            <span>Their order</span>
            <span className="text-center">Your credit</span>
            <span className="text-right">Their discount</span>
          </div>
          {[
            { range: "Under $500", you: "$10", them: "$20 off" },
            { range: "$500 – $999", you: "$20", them: "$20 off" },
            { range: "$1,000 – $1,999", you: "$30", them: "$20 off" },
            { range: "$2,000+", you: "$50", them: "$20 off" },
          ].map(({ range, you, them }, i) => (
            <div key={i} className="grid grid-cols-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">{range}</span>
              <span className="text-center font-semibold text-emerald-700 dark:text-emerald-400">{you}</span>
              <span className="text-right text-gray-500 dark:text-gray-400">{them}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral code + link */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8">
        <p className="text-[10px]  sm:text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">Your Referral Benefits</p>

        <div className="space-y-5">
          <div>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mb-1.5">Your code</p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <span className="font-mono text-base font-semibold tracking-widest text-gray-900 dark:text-gray-100">{data.referralCode}</span>
              <CopyButton text={data.referralCode} label="Copy code" />
            </div>
          </div>

          <div>
            <p className="text-xs  sm:text-sm text-gray-400 dark:text-gray-500 mb-1.5">Shareable link</p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{referralLink}</span>
              <CopyButton text={referralLink} label="Copy link" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center rounded-xl bg-gray-50 dark:bg-gray-800 py-4 px-3">
              <p className="text-2xl font-light text-gray-900 dark:text-gray-100">{data.successfulReferrals}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Successful</p>
            </div>
            <div className="text-center rounded-xl bg-gray-50 dark:bg-gray-800 py-4 px-3">
              <p className="text-2xl font-light text-gray-900 dark:text-gray-100">{data.pendingReferrals}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Pending</p>
            </div>
          </div>


        </div>
      </div>

      <div className="text-center pt-2">
        <Link href="/products" className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
          Browse the collection &rarr;
        </Link>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export function RewardsClient({ token, sent }: { token: string | null; sent: boolean }) {
  const [rewardsData, setRewardsData] = useState<RewardsData | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verify = useCallback(async (tok: string) => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/rewards/verify?token=${encodeURIComponent(tok)}`);
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error ?? "This link is invalid or has expired.");
      } else {
        setRewardsData(data);
      }
    } catch {
      setVerifyError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (token) verify(token);
  }, [token, verify]);

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400 mb-3">
          BingBing Jade
        </p>
        <h1 className="text-3xl sm:text-4xl font-light text-gray-900 dark:text-gray-100 tracking-tight">
          Client Rewards
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
          {token ? "Your private client benefits." : "Access your referral credit and exclusive benefits."}
        </p>

        {!token && (
          <>
            {/* Quote */}
            <p className="mt-8 text-base sm:text-lg italic font-medium text-emerald-900 dark:text-white max-w-xs mx-auto leading-relaxed tracking-wide">
              &ldquo;Because jade has always been something you share — with people you care about.&rdquo;
            </p>

            {/* Reserved notice */}
            <div className="mt-7 rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 px-5 py-4 text-center">
              <p className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 tracking-wide">Reserved for BingBing Jade clients</p>
              <p className="mt-1 text-xs sm:text-sm text-emerald-700/70 dark:text-emerald-400/70 leading-relaxed">
                Your private referral benefits are unlocked after your first piece arrives.
              </p>
            </div>

            {/* Perks */}
            <div className="mt-5 flex flex-col gap-2 items-center">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <span className="text-emerald-600 dark:text-emerald-400">✦</span>
                Refer a friend and earn up to <span className="font-semibold text-gray-700 dark:text-gray-300">$50 in referral credits</span>
              </div>
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <span className="text-emerald-600 dark:text-emerald-400">✦</span>
                Your credits <span className="font-semibold text-gray-700 dark:text-gray-300">never expire</span>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 dark:border-gray-800" />
          </>
        )}
      </div>

      {/* States */}
      {token ? (
        verifying ? (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500">Verifying your link…</div>
        ) : verifyError ? (
          <div className="mx-auto max-w-md text-center space-y-4">
            <p className="text-sm text-red-600 dark:text-red-400">{verifyError}</p>
            <a href="/rewards" className="inline-block text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
              Request a new link &rarr;
            </a>
          </div>
        ) : rewardsData ? (
          <Dashboard data={rewardsData} />
        ) : null
      ) : sent ? (
        <div className="mx-auto max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700 dark:text-emerald-400">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-900 dark:text-gray-100">Check your inbox</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            If this email is associated with a BingBing Jade order, you&rsquo;ll receive a secure link shortly. It expires in 15 minutes.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Don&rsquo;t see it? Check your spam or promotions folder.
          </p>
          <a href="/rewards" className="inline-block mt-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline">
            Try a different email
          </a>
        </div>
      ) : (
        <EmailForm />
      )}
    </div>
  );
}
