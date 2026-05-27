"use client";

import { useState, useEffect, useRef } from "react";

const PAGE_SIZE = 4;
const AUTO_ADVANCE_MS = 5000;

export type CarouselReview = {
  id: string;
  orderNumber: string;
  datePurchased: string;
  name: string;
  review: string;
  images: { image_url: string }[];
};

function ArrowBtn({
  dir,
  onClick,
}: {
  dir: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="hidden sm:flex w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm shrink-0"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dir === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}

const HARDCODED_REVIEWS: CarouselReview[] = [
  {
    id: "hc-1",
    orderNumber: "BBJ-1024",
    datePurchased: "August 18, 2025",
    name: "Mina L.",
    review: "Absolutely beautiful piece. The jade looked even better in person, and I really appreciated how many videos and lighting angles were provided before I purchased. It made me feel much more confident buying online.",
    images: [],
  },
  {
    id: "hc-2",
    orderNumber: "BBJ-1041",
    datePurchased: "August 29, 2025",
    name: "Sophia T.",
    review: "Communication was great from start to finish. I had a lot of questions about sizing and was guided through everything very patiently. My bangle fits well and the quality is lovely.",
    images: [],
  },
  {
    id: "hc-3",
    orderNumber: "BBJ-1057",
    datePurchased: "September 5, 2025",
    name: "Michelle A.",
    review: "I had looked at jade from a few different sellers before, but I always felt unsure about what I was actually buying. BingBing Jade took the time to explain texture, color, and certification in a way that finally made sense. I felt much more confident choosing my piece.",
    images: [],
  },
  {
    id: "hc-4",
    orderNumber: "BBJ-1073",
    datePurchased: "September 12, 2025",
    name: "Linh N.",
    review: "You can tell a lot of care goes into selecting each piece. The color, texture, and glow were all shown honestly, and the jade I received matched the listing very well. I would definitely purchase again.",
    images: [],
  },
  {
    id: "hc-5",
    orderNumber: "BBJ-1086",
    datePurchased: "September 28, 2025",
    name: "Grace W.",
    review: "What stood out to me was the education behind the purchase. I had seen similar-looking pieces elsewhere, but I didn't understand why the prices were different until everything was explained clearly. The transparency made the experience feel very trustworthy.",
    images: [],
  },
  {
    id: "hc-6",
    orderNumber: "BBJ-1098",
    datePurchased: "October 22, 2025",
    name: "Alyssa R.",
    review: "I was nervous about buying jade online, but the seller was transparent, detailed, and helpful. The certification gave me peace of mind, and the piece feels very special in hand.",
    images: [],
  },
  {
    id: "hc-7",
    orderNumber: "BBJ-1109",
    datePurchased: "November 19, 2025",
    name: "Annie N.",
    review: "I bought jade once before and realized later that I didn't really understand the certificate or quality details. This time, I felt guided instead of rushed. The seller answered my questions honestly and helped me choose a piece that matched what I actually wanted.",
    images: [],
  },
  {
    id: "hc-8",
    orderNumber: "BBJ-1126",
    datePurchased: "December 9, 2025",
    name: "Vanessa C.",
    review: "My bracelet arrived safely and was packaged very securely. The jade has such a soft glow in natural light. It feels elegant, substantial, and clearly high quality.",
    images: [],
  },
  {
    id: "hc-9",
    orderNumber: "BBJ-1164",
    datePurchased: "December 22, 2025",
    name: "Jenny P.",
    review: "What I liked most was the honesty. The seller explained how jade can look different in different lighting and took the time to send multiple videos. That transparency meant a lot to me.",
    images: [],
  },
  {
    id: "hc-10",
    orderNumber: "BBJ-1187",
    datePurchased: "January 11, 2026",
    name: "Thao H.",
    review: "I requested help sourcing a specific look and was so happy with the result. The piece felt thoughtfully chosen rather than just randomly picked. It really suits my style.",
    images: [],
  },
  {
    id: "hc-11",
    orderNumber: "BBJ-1199",
    datePurchased: "January 30, 2026",
    name: "Rachel D.",
    review: "The expedited shipping option was worth it for me. Everything arrived smoothly, and the jade was exactly the kind of refined, natural piece I was hoping for.",
    images: [],
  },
  {
    id: "hc-12",
    orderNumber: "BBJ-1208",
    datePurchased: "February 14, 2026",
    name: "Emily K.",
    review: "The bangle is gorgeous and feels even more luxurious in person. I also appreciated how clearly the store policies and expectations were explained before purchase. It made the whole process feel professional.",
    images: [],
  },
  {
    id: "hc-13",
    orderNumber: "BBJ-1211",
    datePurchased: "March 3, 2026",
    name: "Tina V.",
    review: "Beautiful natural jade and excellent service. I loved that the seller clearly explained origin, type, and certification instead of being vague. It made me trust the shop a lot more.",
    images: [],
  },
  {
    id: "hc-14",
    orderNumber: "BBJ-1236",
    datePurchased: "Apr 8, 2026",
    name: "Candice M.",
    review: `From the beginning to the end of the process, ordering my Monet jade bangle was a smooth and enjoyable experience. The seller was very communicative throughout every stage, from selecting the raw material to the finished product, and provided lots of updates and photos along the way which made me feel very confident in my purchase.\n\nI'm extremely happy with both the customer service and the bangle itself. The piece is beautiful, unique, and very high quality with an excellent polish and a beautiful colour combination. I am especially glad I went with a raw material purchase as that allowed it to be made in my ideal size and shape, which can be difficult to find.\n\nYou can really tell care and attention went into the entire process, even at the end with the beautiful packaging. I've already started looking at other pieces from BingBing Jade and would definitely purchase again.`,
    images: [],
  },
  {
    id: "hc-15",
    orderNumber: "BBJ-1252",
    datePurchased: "May 5, 2026",
    name: "Melissa C.",
    review: "100% would recommend! Bing Bing is very kind and responsive to my inquiries. The item was very well packed (and I've never seen such beautiful packaging before!) - you can tell this company really puts a lot of thought and care into their business. The bangle that I purchased was exactly as described/depicted and I love it so much. Thank you for the free gifts, too!",
    images: [],
  },
  {
    id: "hc-16",
    orderNumber: "BBJ-1256",
    datePurchased: "May 9, 2026",
    name: "Gracie W.",
    review: "Such an incredible bangle! Very reasonable prices for various qualities/sizes and beautiful cared for packaging!",
    images: [],
  },
];

const PREVIEW_LENGTH = 180;

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, s) => (
        <svg key={s} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewModal({ review, onClose }: { review: CarouselReview; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block mb-2">&ldquo;</span>

        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto pr-1">
          {review.review}
        </p>

        <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block text-right mt-2">&rdquo;</span>

        {/* Images */}
        {review.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {review.images.map((img, i) => (
              <a key={i} href={img.image_url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}

        <StarRating />

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{review.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{review.datePurchased}</p>
          </div>
          <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{review.orderNumber}</span>
        </div>
      </div>
    </div>
  );
}

export function ReviewsCarousel({ dbReviews }: { dbReviews?: CarouselReview[] }) {
  const [modalReview, setModalReview] = useState<CarouselReview | null>(null);
  const [page, setPage] = useState(0);
  const [mobileSubIndex, setMobileSubIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // DB reviews first (most recent approved), then hardcoded fallback to fill remaining slots
  const dbIds = new Set((dbReviews ?? []).map((r) => r.orderNumber));
  const combined = [
    ...(dbReviews ?? []),
    ...HARDCODED_REVIEWS.filter((r) => !dbIds.has(r.orderNumber)),
  ];

  const totalPages = Math.ceil(combined.length / PAGE_SIZE);
  const pageReviews = combined.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const globalIndex = page * PAGE_SIZE + mobileSubIndex;

  // Auto-advance: step 1 globally so mobile moves 1 card at a time
  useEffect(() => {
    if (paused || modalReview) return;
    timerRef.current = setInterval(() => {
      const nextGlobal = (globalIndex + 1) % combined.length;
      setPage(Math.floor(nextGlobal / PAGE_SIZE));
      setMobileSubIndex(nextGlobal % PAGE_SIZE);
    }, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, modalReview, globalIndex, combined.length]);

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // Desktop: jump a full page, reset mobile sub-index
  function goTo(next: number) {
    resetTimer();
    const newPage = (next + totalPages) % totalPages;
    setPage(newPage);
    setMobileSubIndex(0);
  }

  // Mobile: step 1 at a time through all reviews
  function goMobile(dir: 1 | -1) {
    resetTimer();
    const nextGlobal = (globalIndex + dir + combined.length) % combined.length;
    setPage(Math.floor(nextGlobal / PAGE_SIZE));
    setMobileSubIndex(nextGlobal % PAGE_SIZE);
  }

  return (
    <div
      className="py-16 bg-white dark:bg-gray-950"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 mb-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Happy Customers
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">What People Are Saying</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Mobile: inline arrows + counter */}
            <div className="flex sm:hidden items-center gap-2">
              <button onClick={() => goMobile(-1)} aria-label="Previous" className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 text-center">{globalIndex + 1} / {combined.length}</span>
              <button onClick={() => goMobile(1)} aria-label="Next" className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Desktop: page arrows + dot indicators */}
            <ArrowBtn dir="left" onClick={() => goTo(page - 1)} />
            <div className="hidden sm:flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Page ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === page
                      ? "w-4 h-2 bg-emerald-500 dark:bg-emerald-400"
                      : "w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>
            <ArrowBtn dir="right" onClick={() => goTo(page + 1)} />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="mx-auto max-w-7xl px-6">
        {/* Mobile: single card */}
        <div className="sm:hidden">
          {(() => {
            const r = pageReviews[mobileSubIndex] ?? pageReviews[0];
            if (!r) return null;
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;
            return (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col">
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-2">&ldquo;</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{preview}</p>
                {isLong && (
                  <button onClick={() => setModalReview(r)} className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start">See more</button>
                )}
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-2">&rdquo;</span>
                {r.images.length > 0 && (
                  <div className="flex gap-1.5 mt-3 mb-1">
                    {r.images.slice(0, 3).map((img, i) => (
                      <a key={i} href={img.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block w-14 h-14 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                    {r.images.length > 3 && (
                      <button onClick={() => setModalReview(r)} className="w-14 h-14 rounded-md border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 shrink-0">+{r.images.length - 3}</button>
                    )}
                  </div>
                )}
                <StarRating />
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{r.orderNumber}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Desktop: 4-column grid */}
        <div className="hidden sm:grid sm:grid-cols-2 min-[750px]:grid-cols-3 lg:grid-cols-4 gap-5">
          {pageReviews.map((r) => {
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;

            return (
              <div
                key={r.id}
                className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col"
              >
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-2">&ldquo;</span>

                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                  {preview}
                </p>

                {isLong && (
                  <button
                    onClick={() => setModalReview(r)}
                    className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start"
                  >
                    See more
                  </button>
                )}

                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-2">&rdquo;</span>

                {/* Review images (thumbnails, up to 3 shown) */}
                {r.images.length > 0 && (
                  <div className="flex gap-1.5 mt-3 mb-1">
                    {r.images.slice(0, 3).map((img, i) => (
                      <a
                        key={i}
                        href={img.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block w-14 h-14 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                    {r.images.length > 3 && (
                      <button
                        onClick={() => setModalReview(r)}
                        className="w-14 h-14 rounded-md border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        +{r.images.length - 3}
                      </button>
                    )}
                  </div>
                )}

                <StarRating />

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{r.orderNumber}</span>
                </div>
              </div>
            );
          })}
        </div>  {/* end desktop grid */}
      </div>

      {modalReview && (
        <ReviewModal review={modalReview} onClose={() => setModalReview(null)} />
      )}
    </div>
  );
}
