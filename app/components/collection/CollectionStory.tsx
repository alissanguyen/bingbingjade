"use client";

import { useEffect, useRef, useState } from "react";

interface CollectionStoryProps {
  title?: string;
  paragraphs?: string[];
  footer?: string;
}

const DEFAULT_TITLE = "Hand-Selected. Exclusively BingBing.";

const DEFAULT_PARAGRAPHS = [
  "A piece from this collection is not simply found — it is chosen.",
  "Each bangle begins with jadeite we personally hand-select, following the journey from raw material to final polish and finish. Every tone, texture, and silhouette is chosen with intention, creating pieces that feel deeply connected to BingBing Jade.",
  "Our exclusives are made for us, and offered only through us — never mass-listed inventory shared across countless sellers.",
  "Most pieces include upgraded NGTC certification for added confidence, while select naturally imperfect pieces may appear separately as Clearance Highlights.",
  "Fast US shipping available on ready-to-ship pieces.",
];

const DEFAULT_FOOTER = "Natural, always.";

export function CollectionStory({
  title = DEFAULT_TITLE,
  paragraphs = DEFAULT_PARAGRAPHS,
  footer = DEFAULT_FOOTER,
}: CollectionStoryProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{ background: "linear-gradient(to bottom, transparent 0%, #020817 6%, #020817 94%, transparent 100%)" }}
    >
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-12 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, var(--tw-gradient-from, transparent), #020817)" }} />

      <div
        className="relative mx-auto max-w-225 px-6 sm:px-12 py-20 sm:py-28"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        {/* Decorative rule */}
        <div className="flex items-center gap-5 mb-10 sm:mb-14">
          <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to right, transparent, #2d4a3e)" }} />
          <span className="text-[10px] sm:text-[13px] tracking-[0.35em] uppercase font-semibold text-emerald-700/60">BingBing Jade Exclusive Collection</span>
          <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to left, transparent, #2d4a3e)" }} />
        </div>

        {/* Heading */}
        <h2
          className="text-[22px] sm:text-[36px] font-light text-white leading-snug tracking-wide mb-10 sm:mb-12"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: "0.03em" }}
        >
          {title}
        </h2>

        {/* Body */}
        <div className="space-y-5 sm:space-y-6">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={`text-[14px] sm:text-[18px] leading-[1.85] ${i === 0
                  ? "text-slate-400 font-light italic"
                  : "text-gray-400"
                }`}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.7s ease ${0.1 + i * 0.08}s, transform 0.7s ease ${0.1 + i * 0.08}s`,
              }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* Footer line */}
        {footer && (
          <p
            className="mt-8 sm:mt-12 text-[13px] sm:text-[14px] italic tracking-[0.25em] uppercase font-medium text-emerald-500/70"
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 1s ease 0.6s",
            }}
          >
            THE BINGBING&#39;S PROMISE — &quot;{footer}&ldquo;
          </p>
        )}

        {/* Bottom decorative rule */}
        <div className="flex items-center gap-5 mt-10 sm:mt-14">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #2d4a3e)" }} />
          <div className="w-1 h-1 rounded-full bg-emerald-700/40" />
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #2d4a3e)" }} />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--tw-gradient-from, transparent), #020817)" }} />
    </section>
  );
}
