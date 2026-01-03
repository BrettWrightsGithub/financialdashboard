"use client";

import { useState, useEffect } from "react";
import type { AuditLogEntry } from "@/lib/categorization/auditLog";

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  transactionDescription?: string;
}

export function AuditHistoryModal({
  isOpen,
  onClose,
  transactionId,
  transactionDescription,
}: AuditHistoryModalProps) {
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchHistory();
    }
  }, [isOpen, transactionId]);

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/audit`);
      if (!res.ok) throw new Error("Failed to fetch audit history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const sourceLabels: Record<string, string> = {
    plaid: "Plaid",
    rule: "Rule",
    manual: "Manual",
    payee_memory: "Learned",
    bulk_edit: "Bulk Edit",
    reimbursement_link: "Reimbursement Link",
    system: "System",
  };

  const sourceColors: Record<string, string> = {
    plaid: "bg-blue-100 text-blue-700",
    rule: "bg-purple-100 text-purple-700",
    manual: "bg-green-100 text-green-700",
    payee_memory: "bg-amber-100 text-amber-700",
    bulk_edit: "bg-indigo-100 text-indigo-700",
    reimbursement_link: "bg-teal-100 text-teal-700",
    system: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Category History
          </h2>
          {transactionDescription && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              {transactionDescription}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No category changes recorded for this transaction.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`relative pl-6 pb-4 ${
                    index < history.length - 1
                      ? "border-l-2 border-slate-200 dark:border-slate-700"
                      : ""
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />

                  {/* Entry content */}
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded font-medium ${
                          sourceColors[entry.changeSource] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {sourceLabels[entry.changeSource] || entry.changeSource}
                      </span>
                      {entry.isReverted && (
                        <span className="px-2 py-0.5 text-xs rounded font-medium bg-red-100 text-red-700">
                          Reverted
                        </span>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        {entry.previousCategoryName || "(none)"}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {entry.newCategoryName || "(none)"}
                      </span>
                    </div>

                    {entry.ruleName && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Rule: {entry.ruleName}
                      </div>
                    )}

                    {entry.confidenceScore && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Confidence: {Math.round(entry.confidenceScore * 100)}%
                      </div>
                    )}

                    {entry.notes && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                        {entry.notes}
                      </div>
                    )}

                    <div className="text-xs text-slate-400 mt-1">
                      By: {entry.changedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
