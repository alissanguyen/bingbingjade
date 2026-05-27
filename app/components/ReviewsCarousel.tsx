"use client";

import { useState } from "react";

const reviews = [
  {
    orderNumber: "BBJ-1024",
    datePurchased: "August 18, 2025",
    name: "Mina L.",
    review:
      "Absolutely beautiful piece. The jade looked even better in person, and I really appreciated how many videos and lighting angles were provided before I purchased. It made me feel much more confident buying online.",
  },
  {
    orderNumber: "BBJ-1041",
    datePurchased: "August 29, 2025",
    name: "Sophia T.",
    review:
      "Communication was great from start to finish. I had a lot of questions about sizing and was guided through everything very patiently. My bangle fits well and the quality is lovely.",
  },
  {
    orderNumber: "BBJ-1057",
    datePurchased: "September 5, 2025",
    name: "Michelle A.",
    review:
      "I had looked at jade from a few different sellers before, but I always felt unsure about what I was actually buying. BingBing Jade took the time to explain texture, color, and certification in a way that finally made sense. I felt much more confident choosing my piece.",
  },
  {
    orderNumber: "BBJ-1073",
    datePurchased: "September 12, 2025",
    name: "Linh N.",
    review:
      "You can tell a lot of care goes into selecting each piece. The color, texture, and glow were all shown honestly, and the jade I received matched the listing very well. I would definitely purchase again.",
  },
  {
    orderNumber: "BBJ-1086",
    datePurchased: "September 28, 2025",
    name: "Grace W.",
    review:
      "What stood out to me was the education behind the purchase. I had seen similar-looking pieces elsewhere, but I didn’t understand why the prices were different until everything was explained clearly. The transparency made the experience feel very trustworthy.",
  },
  {
    orderNumber: "BBJ-1098",
    datePurchased: "October 22, 2025",
    name: "Alyssa R.",
    review:
      "I was nervous about buying jade online, but the seller was transparent, detailed, and helpful. The certification gave me peace of mind, and the piece feels very special in hand.",
  },
  {
    orderNumber: "BBJ-1109",
    datePurchased: "November 19, 2025",
    name: "Annie N.",
    review:
      "I bought jade once before and realized later that I didn’t really understand the certificate or quality details. This time, I felt guided instead of rushed. The seller answered my questions honestly and helped me choose a piece that matched what I actually wanted.",
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
    orderNumber: "BBJ-1187",
    datePurchased: "January 11, 2026",
    name: "Thao H.",
    review:
      "I requested help sourcing a specific look and was so happy with the result. The piece felt thoughtfully chosen rather than just randomly picked. It really suits my style.",
  },
  {
    orderNumber: "BBJ-1199",
    datePurchased: "January 30, 2026",
    name: "Rachel D.",
    review:
      "The expedited shipping option was worth it for me. Everything arrived smoothly, and the jade was exactly the kind of refined, natural piece I was hoping for.",
  },
  {
    orderNumber: "BBJ-1208",
    datePurchased: "February 14, 2026",
    name: "Emily K.",
    review:
      "The bangle is gorgeous and feels even more luxurious in person. I also appreciated how clearly the store policies and expectations were explained before purchase. It made the whole process feel professional.",
  },
  {
    orderNumber: "BBJ-1211",
    datePurchased: "March 3, 2026",
    name: "Tina V.",
    review:
      "Beautiful natural jade and excellent service. I loved that the seller clearly explained origin, type, and certification instead of being vague. It made me trust the shop a lot more.",
  },
  {
    orderNumber: "BBJ-1236",
    datePurchased: "Apr 8, 2026",
    name: "Candice M.",
    review: `From the beginning to the end of the process, ordering my Monet jade bangle was a smooth and enjoyable experience. The seller was very communicative throughout every stage, from selecting the raw material to the finished product, and provided lots of updates and photos along the way which made me feel very confident in my purchase.

I’m extremely happy with both the customer service and the bangle itself. The piece is beautiful, unique, and very high quality with an excellent polish and a beautiful colour combination. I am especially glad I went with a raw material purchase as that allowed it to be made in my ideal size and shape, which can be difficult to find.

You can really tell care and attention went into the entire process, even at the end with the beautiful packaging. I’ve already started looking at other pieces from BingBing Jade and would definitely purchase again.`,
  },
  {
    orderNumber: "BBJ-1252",
    datePurchased: "May 5, 2026",
    name: "Melissa C.",
    review:
      "100% would recommend!  Bing Bing is very kind and responsive to my inquiries.  The item was very well packed (and I’ve never seen such beautiful packaging before!) - you can tell this company really puts a lot of thought and care into their business.  The bangle that I purchased was exactly as described/depicted and I love it so much.  Thank you for the free gifts, too!",
  },

  {
    orderNumber: "BBJ-1256",
    datePurchased: "May 9, 2026",
    name: "Gracie W.",
    review:
      "Such an incredible bangle! Very reasonable prices for various qualities/sizes and beautiful cared for packaging!",
  }
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
