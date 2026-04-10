"use client";

import { useState, useMemo } from "react";

export interface PickerSubscriber {
  id: string;
  email: string;
  subscribed_at: string;
}

export function SubscriberPicker({
  subscribers,
  selected,
  onChange,
}: {
  subscribers: PickerSubscriber[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() =>
    query.trim()
      ? subscribers.filter((s) => s.email.toLowerCase().includes(query.toLowerCase()))
      : subscribers,
    [subscribers, query]
  );

  function toggle(email: string) {
    const next = new Set(selected);
    next.has(email) ? next.delete(email) : next.add(email);
    onChange(next);
  }

  function toggleAll() {
    if (selected.size === subscribers.length) {
      onChange(new Set());
    } else {
      onChange(new Set(subscribers.map((s) => s.email)));
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Search + select all */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email…"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
        >
          {selected.size === subscribers.length ? "Deselect all" : "Select all"}
        </button>
        <span className="text-xs text-gray-400 whitespace-nowrap">{selected.size} selected</span>
      </div>

      {/* List */}
      <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">No subscribers found.</p>
        ) : (
          filtered.map((s) => (
            <label
              key={s.email}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(s.email)}
                onChange={() => toggle(s.email)}
                className="accent-emerald-600 w-3.5 h-3.5 shrink-0"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{s.email}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
