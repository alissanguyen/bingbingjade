"use client";

import { useState, useEffect, useRef } from "react";

interface AccordionItem {
  heading: string;
  content: React.ReactNode;
  id?: string;
}

function AccordionRow({ heading, content, id }: AccordionItem) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // On mount: open and scroll if the URL hash matches this item
  useEffect(() => {
    if (!id) return;
    if (window.location.hash.slice(1) === id) {
      setOpen(true);
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [id]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (id) {
      history.replaceState(null, "", next ? `#${id}` : window.location.pathname);
    }
  };

  return (
    <div id={id} ref={ref} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{heading}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pb-5 text-[16px] sm:text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {items.map((item, i) => (
        <AccordionRow key={i} heading={item.heading} content={item.content} id={item.id} />
      ))}
    </div>
  );
}
