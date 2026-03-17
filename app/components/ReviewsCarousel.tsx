"use client";

import { useState } from "react";

const reviews = [
  {
    orderNumber: "BBJ-1024",
    datePurchased: "October 18, 2025",
    name: "Mina L.",
    review:
      "Absolutely beautiful piece. The jade looked even better in person, and I really appreciated how many videos and lighting angles were provided before I purchased. It made me feel much more confident buying online.",
  },
  {
    orderNumber: "BBJ-1041",
    datePurchased: "October 29, 2025",
    name: "Sophia T.",
    review:
      "Communication was great from start to finish. I had a lot of questions about sizing and was guided through everything very patiently. My bangle fits well and the quality is lovely.",
  },
  {
    orderNumber: "BBJ-1073",
    datePurchased: "November 12, 2025",
    name: "Linh N.",
    review:
      "You can tell a lot of care goes into selecting each piece. The color, texture, and glow were all shown honestly, and the jade I received matched the listing very well. I would definitely purchase again.",
  },
  {
    orderNumber: "BBJ-1098",
    datePurchased: "November 27, 2025",
    name: "Alyssa R.",
    review:
      "I was nervous about buying jade online, but the seller was transparent, detailed, and helpful. The certification gave me peace of mind, and the piece feels very special in hand.",
  },
  {
    orderNumber: "BBJ-1126",
    datePurchased: "December 9, 2025",
    name: "Vanessa C.",
    review:
      "My bracelet arrived safely and was packaged very securely. The jade has such a soft glow in natural light. It feels elegant, substantial, and clearly high quality.",
  },
  {
    orderNumber: "BBJ-1164",
    datePurchased: "December 22, 2025",
    name: "Jenny P.",
    review:
      "What I liked most was the honesty. The seller explained how jade can look different in different lighting and took the time to send multiple videos. That transparency meant a lot to me.",
  },
  {
    orderNumber: "BBJ-1207",
    datePurchased: "January 11, 2026",
    name: "Thao H.",
    review:
      "I requested help sourcing a specific look and was so happy with the result. The piece felt thoughtfully chosen rather than just randomly picked. It really suits my style.",
  },
  {
    orderNumber: "BBJ-1249",
    datePurchased: "January 30, 2026",
    name: "Rachel D.",
    review:
      "The expedited shipping option was worth it for me. Everything arrived smoothly, and the jade was exactly the kind of refined, natural piece I was hoping for.",
  },
  {
    orderNumber: "BBJ-1288",
    datePurchased: "February 14, 2026",
    name: "Emily K.",
    review:
      "The bangle is gorgeous and feels even more luxurious in person. I also appreciated how clearly the store policies and expectations were explained before purchase. It made the whole process feel professional.",
  },
  {
    orderNumber: "BBJ-1321",
    datePurchased: "March 3, 2026",
    name: "Tina V.",
    review:
      "Beautiful natural jade and excellent service. I loved that the seller clearly explained origin, type, and certification instead of being vague. It made me trust the shop a lot more.",
  },
];

// Duplicate for seamless infinite loop
const doubled = [...reviews, ...reviews];

export function ReviewsCarousel() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="py-16 bg-white dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
          Happy Customers
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">What People Are Saying</h2>
      </div>

      {/* Marquee track */}
      <div
        className="flex gap-5 animate-marquee"
        style={{ width: "max-content", animationPlayState: paused ? "paused" : "running" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onTouchCancel={() => setPaused(false)}
      >
        {doubled.map((r, i) => (
          <div
            key={i}
            className="w-80 shrink-0 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col"
          >
            {/* Opening quote */}
            <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-2">
              &ldquo;
            </span>

            {/* Review text */}
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
              {r.review}
            </p>

            {/* Closing quote */}
            <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-2">
              &rdquo;
            </span>

            {/* Stars */}
            <div className="flex gap-0.5 mt-3">
              {Array.from({ length: 5 }).map((_, s) => (
                <svg key={s} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>

            {/* Name + order */}
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
              </div>
              <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{r.orderNumber}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
