"use client";

interface CategorySourceBadgeProps {
  source: string | null;
  confidence?: number | null;
  ruleName?: string | null;
}

/**
 * Displays a badge indicating how a transaction was categorized.
 * - Plaid (blue): Categorized by Plaid's ML
 * - Rule (purple): Categorized by a user-defined rule
 * - Manual (green): Manually set by user
 * - AI (orange): Categorized by AI suggestion
 */
export function CategorySourceBadge({ source, confidence, ruleName }: CategorySourceBadgeProps) {
  if (!source) return null;

  const config: Record<string, { label: string; className: string }> = {
    plaid: {
      label: "Plaid",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    rule: {
      label: ruleName ? `Rule: ${ruleName}` : "Rule",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    },
    manual: {
      label: "Manual",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    ai: {
      label: "AI",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    },
    override: {
      label: "Override",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    payee_memory: {
      label: "Learned",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
    bulk_edit: {
      label: "Bulk",
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    },
    reimbursement_link: {
      label: "Linked",
      className: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    },
    system: {
      label: "System",
      className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    },
  };

  const sourceConfig = config[source.toLowerCase()] || {
    label: source,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };

  const parts = [sourceConfig.label];
  if (confidence) parts.push(`${Math.round(confidence * 100)}% conf`);
  const title = parts.join(" • ");

  return (
    <span
      className={`px-1.5 py-0.5 text-xs rounded font-medium ${sourceConfig.className}`}
      title={title}
    >
      {sourceConfig.label}
    </span>
  );
}
