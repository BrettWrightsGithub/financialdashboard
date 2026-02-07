import type { ParsedRulePayload } from "@/lib/assistant/types";

interface RulePreviewCardProps {
  rule: ParsedRulePayload;
}

export function RulePreviewCard({ rule }: RulePreviewCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3 text-xs space-y-1">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{rule.name}</div>
      <div>Merchant contains: <span className="font-medium">{rule.match_merchant_contains || "-"}</span></div>
      <div>Category: <span className="font-medium">{rule.assign_category_name || "-"}</span></div>
      <div>Direction: <span className="font-medium">{rule.match_direction || "any"}</span></div>
      <div>Amount min/max: <span className="font-medium">{rule.match_amount_min ?? "-"} / {rule.match_amount_max ?? "-"}</span></div>
      <div>Priority: <span className="font-medium">{rule.priority}</span></div>
    </div>
  );
}
