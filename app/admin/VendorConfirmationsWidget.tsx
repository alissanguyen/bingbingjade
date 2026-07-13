import Link from "next/link";

export type VendorConfirmationOrder = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  authorized_amount: number | null;
  authorization_expires_at: string | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Badge tier — mirrors the logic used in the order detail Payment card
// (app/orders-admin/[id]/OrderDetailClient.tsx captureDeadlineBadge).
function badgeFor(expiresAt: string | null): { label: string; color: string } {
  if (!expiresAt) return { label: "Normal", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return { label: "Expired", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (hoursLeft < 24) return { label: "Urgent (<24h)", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (hoursLeft < 48) return { label: "Warning (<48h)", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: "Normal", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
}

// "Vendor Confirmations Requiring Action" — Sourced for You orders whose
// payment is authorized but not yet captured, sorted by how soon the
// authorization is estimated to expire. Server-rendered, no interactivity
// needed beyond navigating to the order.
export function VendorConfirmationsWidget({ orders }: { orders: VendorConfirmationOrder[] }) {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-10">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Vendor Confirmations Requiring Action
          {orders.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold">
              {orders.length}
            </span>
          )}
        </h2>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No authorizations awaiting vendor confirmation.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => {
              const badge = badgeFor(order.authorization_expires_at);
              return (
                <li key={order.id}>
                  <Link
                    href={`/orders-admin/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {order.order_number ?? "No Order #"} — {order.customer_name ?? "Unknown customer"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {order.authorized_amount != null ? `$${(order.authorized_amount / 100).toFixed(2)} authorized` : "Amount unknown"}
                        {order.authorization_expires_at ? ` · deadline ${fmt(order.authorization_expires_at)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                      {badge.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
