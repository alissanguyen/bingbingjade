import Link from "next/link";

const EMAIL_TYPES = [
  {
    href: "/custom-emails-admin/new-drops",
    icon: "✦",
    label: "New Drops",
    description: "Showcase recently added products to all subscribers or a selected list.",
    color: "emerald",
  },
  {
    href: "/custom-emails-admin/order-delays",
    icon: "⏳",
    label: "Order Delays",
    description: "Notify customers with undelivered orders about a delay with a luxury touch.",
    color: "amber",
  },
  {
    href: "/custom-emails-admin/new-blog",
    icon: "✍︎",
    label: "New Blog",
    description: "Announce a published blog post to all subscribers or a selected list.",
    color: "sky",
  },
  {
    href: "/custom-emails-admin/care-tips",
    icon: "♡",
    label: "Care Tips",
    description: "Send jade care instructions to customers whose orders were recently delivered.",
    color: "violet",
  },
];

const colorMap: Record<string, { card: string; icon: string; badge: string }> = {
  emerald: {
    card: "hover:border-emerald-300 dark:hover:border-emerald-700",
    icon: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    badge: "text-emerald-700 dark:text-emerald-400",
  },
  amber: {
    card: "hover:border-amber-300 dark:hover:border-amber-700",
    icon: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    badge: "text-amber-700 dark:text-amber-400",
  },
  sky: {
    card: "hover:border-sky-300 dark:hover:border-sky-700",
    icon: "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400",
    badge: "text-sky-700 dark:text-sky-400",
  },
  violet: {
    card: "hover:border-violet-300 dark:hover:border-violet-700",
    icon: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
    badge: "text-violet-700 dark:text-violet-400",
  },
};

export default function CustomEmailsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">
          Admin
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Custom Emails</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compose and send targeted emails to your subscribers and customers.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {EMAIL_TYPES.map((t) => {
          const c = colorMap[t.color];
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`group flex items-start gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 transition-all hover:shadow-md ${c.card}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${c.icon}`}>
                {t.icon}
              </div>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${c.badge}`}>
                  {t.label}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {t.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
