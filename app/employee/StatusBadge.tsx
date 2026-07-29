const STATUS_STYLES: Record<string, string> = {
  EMPLOYEE_DRAFT: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  AWAITING_APPROVAL: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
  NEEDS_ADJUSTMENT: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  APPROVED_UNPUBLISHED: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400",
  PUBLISHED: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  ARCHIVED: "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  EMPLOYEE_DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting Approval",
  NEEDS_ADJUSTMENT: "Needs Adjustment",
  APPROVED_UNPUBLISHED: "Approved (Unpublished)",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: string | null }) {
  const key = status ?? "EMPLOYEE_DRAFT";
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[key] ?? STATUS_STYLES.EMPLOYEE_DRAFT}`}>
      {STATUS_LABELS[key] ?? key}
    </span>
  );
}
