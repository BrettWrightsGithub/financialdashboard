"use client";

import type { TransactionWithDetails } from "@/types/database";

interface TransferChainModalProps {
  transaction: TransactionWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onBreakLink: (transactionId: string) => Promise<void>;
}

export function TransferChainModal({ transaction, isOpen, onClose, onBreakLink }: TransferChainModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transfer Chain</h3>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        </div>

        <div className="card p-3 text-sm">
          <div className="font-medium">{transaction.description_clean || transaction.description_raw}</div>
          <div className="text-xs text-slate-500 mt-1">{transaction.date} • {transaction.amount.toFixed(2)}</div>
        </div>

        <div className="text-sm text-slate-600 dark:text-slate-300">
          <div>Counterpart ID: <span className="font-mono text-xs">{transaction.transfer_pair_id || "N/A"}</span></div>
          <div className="mt-1">Match source: {transaction.transfer_match_source || "manual"}</div>
          <div>Confidence: {Math.round((transaction.transfer_match_confidence || 0) * 100)}%</div>
        </div>

        {transaction.transfer_pair_id && (
          <button
            className="btn-secondary text-sm"
            onClick={async () => {
              await onBreakLink(transaction.id);
              onClose();
            }}
          >
            Break Link
          </button>
        )}
      </div>
    </div>
  );
}
