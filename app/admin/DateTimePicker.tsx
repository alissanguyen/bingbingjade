"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

interface Props {
  value: string | null;        // ISO string or null
  onChange: (iso: string | null) => void;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatDisplay(iso: string | null): string {
  if (!iso) return "Pick a date & time";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function DateTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse stored ISO into local date/time parts
  const selected = value ? new Date(value) : undefined;
  const [hour, setHour]     = useState(selected ? selected.getHours() : 12);
  const [minute, setMinute] = useState(selected ? selected.getMinutes() : 0);

  // Sync hour/minute when value loads from server (initial state is set before fetch completes)
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setHour(d.getHours());
      setMinute(d.getMinutes());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function applyDateTime(day: Date | undefined, h: number, m: number) {
    if (!day) { onChange(null); return; }
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    onChange(d.toISOString());
  }

  function handleDaySelect(day: Date | undefined) {
    applyDateTime(day, hour, minute);
  }

  function handleHour(h: number) {
    setHour(h);
    applyDateTime(selected, h, minute);
  }

  function handleMinute(m: number) {
    setMinute(m);
    applyDateTime(selected, hour, m);
  }

  return (
    <div ref={ref} className="relative w-fit">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
          open
            ? "border-emerald-500 ring-1 ring-emerald-500 bg-white dark:bg-gray-900"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
        } text-gray-800 dark:text-gray-200`}
      >
        <CalendarIcon />
        <span className={value ? "" : "text-gray-400 dark:text-gray-500"}>
          {formatDisplay(value)}
        </span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          {/* Calendar */}
          <div className="px-2 pt-2 rdp-custom">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleDaySelect}
              captionLayout="dropdown"
              startMonth={new Date()}
              endMonth={new Date(new Date().getFullYear() + 3, 11)}
            />
          </div>

          {/* Time selector */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 w-10">Time</span>

            {/* Hour */}
            <select
              value={hour}
              onChange={(e) => handleHour(Number(e.target.value))}
              className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{pad(i)}</option>
              ))}
            </select>

            <span className="text-gray-400 font-semibold">:</span>

            {/* Minute */}
            <select
              value={minute}
              onChange={(e) => handleMinute(Number(e.target.value))}
              className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>{pad(m)}</option>
              ))}
            </select>

            <span className="text-xs text-gray-400 dark:text-gray-500">local time</span>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-xs font-medium text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
