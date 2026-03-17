"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductCardImage({
  images,
  name,
  children,
}: {
  images: string[];
  name: string;
  children?: React.ReactNode;
}) {
  const [peeking, setPeeking] = useState(false);
  const hasTwo = images.length >= 2;

  return (
    <div className="relative w-full aspect-square bg-emerald-50 dark:bg-emerald-950 overflow-hidden">
      {children}
      {images[0] ? (
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
              src={images[0]}
              alt={name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              loading="lazy"
            />
          </div>
          {images[1] && (
            <div className="relative h-full">
              <Image
                src={images[1]}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                loading="lazy"
                aria-hidden
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-5xl">🪨</div>
      )}
    </div>
  );
}
