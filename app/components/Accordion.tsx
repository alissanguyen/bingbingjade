"use client";

import { useState } from "react";

interface AccordionItem {
  heading: string;
  content: React.ReactNode;
}

function AccordionRow({ heading, content }: AccordionItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{heading}</span>
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
        <div className="pb-5 text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed">
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
        <AccordionRow key={i} heading={item.heading} content={item.content} />
      ))}
    </div>
  );
}
