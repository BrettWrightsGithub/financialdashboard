"use client";

import { useMemo, useState } from "react";
import type { TransactionWithDetails } from "@/types/database";

interface SplitTransactionTreeProps {
  parent: TransactionWithDetails;
  childTransactions: TransactionWithDetails[];
  onDeleteChild?: (childId: string) => void;
  onEditParent?: (parentId: string) => void;
}

export function SplitTransactionTree({ parent, childTransactions, onDeleteChild, onEditParent }: SplitTransactionTreeProps) {
  const [expanded, setExpanded] = useState(false);

  const discrepancy = useMemo(() => {
    const parentAmount = Math.abs(parent.amount);
    const childAmount = childTransactions.reduce((sum, child) => sum + Math.abs(child.amount), 0);
    return Number((parentAmount - childAmount).toFixed(2));
  }, [childTransactions, parent.amount]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800">
        <button className="text-left min-h-[44px]" onClick={() => setExpanded((value) => !value)}>
          <span className="font-medium">{parent.description_clean || parent.description_raw}</span>
          <span className="text-xs text-slate-500 ml-2">{childTransactions.length} split(s)</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{parent.amount.toFixed(2)}</span>
          <button className="btn-secondary text-xs" onClick={() => onEditParent?.(parent.id)}>Edit</button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 space-y-2">
          {childTransactions.map((child) => (
            <div key={child.id} className="flex items-center justify-between text-sm border border-slate-100 dark:border-slate-800 rounded px-3 py-2">
              <div className="truncate">{child.category_name || "Uncategorized"}</div>
              <div className="flex items-center gap-2">
                <span>{child.amount.toFixed(2)}</span>
                <button className="btn-secondary text-xs" onClick={() => onDeleteChild?.(child.id)}>Delete</button>
              </div>
            </div>
          ))}
          {Math.abs(discrepancy) > 0.01 && (
            <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2">
              Split discrepancy detected: {discrepancy.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
