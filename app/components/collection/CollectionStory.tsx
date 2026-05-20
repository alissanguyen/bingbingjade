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
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden bg-stone-100 dark:bg-[#020a1c]"
    >
      {/* Top fade — transitions from page bg into section bg */}
      <div className="absolute inset-x-0 top-0 h-20 pointer-events-none bg-linear-to-b from-white to-stone-100 dark:from-gray-950 dark:to-[#020a1c]" />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-linear-to-t from-white to-stone-100 dark:from-gray-950 dark:to-[#020a1c]" />

      <div
        className="relative mx-auto max-w-225 px-6 sm:px-12 py-20 sm:pb-28 pt-20"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        {/* Decorative rule */}
        <div className="flex items-center gap-5 mb-10 sm:mb-14">
          <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to right, transparent, #2d4a3e)" }} />
          <span className="text-[10px] sm:text-[12px] tracking-[0.35em] uppercase font-semibold text-emerald-700 dark:text-emerald-700/60">
            BingBing Jade
          </span>
          <div className="flex-1 h-[2px]" style={{ background: "linear-gradient(to left, transparent, #2d4a3e)" }} />
        </div>

        {/* Heading */}
        <h2
          className="text-[22px] sm:text-[34px] font-light leading-snug mb-10 sm:mb-12 text-gray-900 dark:text-white"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: "0.03em" }}
        >
          {title}
        </h2>

        {/* Body */}
        <div className="space-y-5 sm:space-y-6">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={`leading-[1.85] ${
                i === 0
                  ? "font-light italic text-gray-600 dark:text-slate-300 text-[16px] sm:text-[20px]"
                  : "text-gray-500 dark:text-white/55 text-[14px] sm:text-[18px]"
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
            className="mt-12 sm:mt-16 text-[12px] sm:text-[15px] tracking-[0.28em] uppercase font-semibold text-emerald-700 dark:text-emerald-500/70 italic"
            style={{
              opacity: visible ? 1 : 0,
              transition: "opacity 1s ease 0.6s",
            }}
          >
            THE BINGBING&#39;S PROMISE — &quot;{footer}&ldquo;
          </p>
        )}

        {/* Bottom decorative rule */}
        <div className="flex items-center gap-4 mt-10 sm:mt-14">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #2d4a3e)" }} />
          <div className="w-1 h-1 rounded-full bg-emerald-700/40" />
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #2d4a3e)" }} />
        </div>
      </div>
    </section>
  );
}
