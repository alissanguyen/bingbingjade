"use client";

import { useState } from "react";
import Image from "next/image";
import { productThumbUrl } from "@/lib/storage";

function JadePlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-900">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30 dark:opacity-20">
        <ellipse cx="20" cy="20" rx="18" ry="14" stroke="#059669" strokeWidth="2"/>
        <ellipse cx="20" cy="20" rx="10" ry="7" stroke="#059669" strokeWidth="1.5"/>
        <ellipse cx="20" cy="20" rx="4" ry="3" fill="#059669" fillOpacity="0.3"/>
      </svg>
    </div>
  );
}

export function ProductCardImage({
  images,
  name,
  priority = false,
  children,
}: {
  images: string[];
  name: string;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const [peeking, setPeeking] = useState(false);
  const [img0Error, setImg0Error] = useState(false);
  const [img1Error, setImg1Error] = useState(false);

  const src0 = images[0] && !img0Error ? productThumbUrl(images[0]) : null;
  const src1 = images[1] && !img1Error ? productThumbUrl(images[1]) : null;
  const hasTwo = src0 != null && src1 != null;

  return (
    <div className="relative w-full aspect-square overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-900">
      {children}
      {src0 ? (
        <div
          className={`grid h-full transition-transform duration-300 ease-in-out ${
            hasTwo
              ? `w-[200%] grid-cols-2 group-hover:animate-peek ${peeking ? "-translate-x-1/5" : ""}`
              : "w-full grid-cols-1"
          }`}
          onTouchStart={hasTwo ? () => setPeeking(true) : undefined}
          onTouchEnd={hasTwo ? () => setPeeking(false) : undefined}
          onTouchCancel={hasTwo ? () => setPeeking(false) : undefined}
        >
          <div className="relative h-full">
            <Image
              src={src0}
              alt={name}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 50vw, 33vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              onError={() => setImg0Error(true)}
            />
          </div>
          {src1 && (
            <div className="relative h-full">
              <Image
                src={src1}
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 50vw, 33vw"
                loading="lazy"
                aria-hidden
                onError={() => setImg1Error(true)}
              />
            </div>
          )}
        </div>
      ) : (
        <JadePlaceholder />
      )}
    </div>
  );
}
