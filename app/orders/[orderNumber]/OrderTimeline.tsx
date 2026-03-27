"use client";

import { useEffect, useState } from "react";
import type { OrderStatus } from "@/types/orders";

type StatusStep = { key: OrderStatus; label: string; description: string };

interface Props {
  steps: StatusStep[];
  currentStatus: OrderStatus;
  isCustom: boolean;
  statusOrder: OrderStatus[];
}

export default function OrderTimeline({ steps, currentStatus, isCustom, statusOrder }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function stepIndex(key: OrderStatus) {
    return statusOrder.indexOf(key);
  }

  const currentIdx = stepIndex(currentStatus);

  return (
    <ol className="relative">
      {steps.map((step, idx) => {
        const stepIdx = stepIndex(step.key);
        const isCompleted = stepIdx < currentIdx;
        const isCurrent = step.key === currentStatus;

        return (
          <li
            key={step.key}
            className="flex gap-4 pb-7 last:pb-0"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(10px)",
              transition: `opacity 0.45s ease ${idx * 70}ms, transform 0.45s ease ${idx * 70}ms`,
            }}
          >
            {/* Dot + connector line */}
            <div className="flex flex-col items-center">
              {/* Dot with optional ping ring */}
              <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
                {isCurrent && (
                  <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-60 animate-ping" />
                )}
                <div
                  className={`w-3 h-3 rounded-full border-2 z-10 relative ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500"
                      : isCurrent
                      ? "bg-amber-400 border-amber-400"
                      : "bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700"
                  }`}
                />
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`w-px flex-1 mt-1 relative overflow-hidden ${
                    isCompleted ? "bg-emerald-400 dark:bg-emerald-700" : "bg-gray-200 dark:bg-gray-800"
                  }`}
                >
                  {isCompleted && (
                    <div
                      className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-white/70 dark:via-white/20 to-transparent animate-line-flow"
                      style={{ animationDelay: `${idx * 300}ms` }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Step content */}
            <div
              className={`pb-1 flex-1 ${
                isCurrent
                  ? "rounded-lg border px-3 py-2 -mt-0.5 bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60"
                  : ""
              }`}
              style={
                isCurrent
                  ? {
                      boxShadow: mounted
                        ? "0 0 0 3px rgba(251,191,36,0.12)"
                        : "0 0 0 0px rgba(251,191,36,0)",
                      transition: "box-shadow 0.6s ease",
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? "text-amber-800 dark:text-amber-200"
                      : isCompleted
                      ? "text-gray-600 dark:text-gray-400"
                      : "text-gray-400 dark:text-gray-600"
                  }`}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <span className="text-xs font-semibold bg-amber-400/20 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 leading-none">
                    Current
                  </span>
                )}
                {isCompleted && (
                  <svg
                    className="text-emerald-500 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {isCurrent && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
