"use client";

import { useState, useEffect } from "react";
import type { BatchInfo } from "@/lib/categorization/retroactiveRules";

export default function BatchHistoryPage() {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [includeUndone, setIncludeUndone] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, [includeUndone]);

  async function fetchBatches() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeUndone) params.set("include_undone", "true");
      
      const res = await fetch(`/api/admin/batches?${params}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo(batchId: string) {
    if (!confirm("Are you sure you want to undo this batch? All category changes will be reverted.")) {
      return;
    }

    setUndoing(batchId);
    try {
      const res = await fetch("/api/rules/undo-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to undo batch");
      }

      const data = await res.json();
      alert(`Successfully reverted ${data.transactions_reverted} transactions.`);
      fetchBatches();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to undo batch");
    } finally {
      setUndoing(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Batch History
        </h1>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={includeUndone}
            onChange={(e) => setIncludeUndone(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show undone batches
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No batch operations found.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Rule / Operation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {batches.map((batch) => (
                <tr key={batch.id} className={batch.isUndone ? "opacity-50" : ""}>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {new Date(batch.appliedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {batch.ruleName || batch.operationType}
                    </div>
                    {batch.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {batch.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {batch.transactionCount}
                  </td>
                  <td className="px-4 py-3">
                    {batch.isUndone ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                        Undone
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!batch.isUndone && (
                      <button
                        onClick={() => handleUndo(batch.id)}
                        disabled={undoing === batch.id}
                        className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {undoing === batch.id ? "Undoing..." : "Undo"}
                      </button>
                    )}
                    {batch.isUndone && batch.undoneAt && (
                      <span className="text-xs text-slate-500">
                        {new Date(batch.undoneAt).toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
