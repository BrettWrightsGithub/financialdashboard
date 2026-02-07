"use client";

import { useEffect, useState } from "react";

interface PreviewPayload {
  wouldChange: number;
  wouldSkipLocked: number;
  totalMatching: number;
  matchingTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    currentCategory: string | null;
    newCategory: string;
    isLocked: boolean;
  }>;
}

interface BackfillModalProps {
  ruleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BackfillModal({ ruleId, isOpen, onClose }: BackfillModalProps) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !ruleId) return;
    setLoading(true);
    fetch("/api/rules/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_id: ruleId }),
    })
      .then((response) => response.json())
      .then((payload) => setPreview(payload))
      .finally(() => setLoading(false));
  }, [isOpen, ruleId]);

  const apply = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const response = await fetch("/api/rules/apply-retroactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: ruleId,
          transaction_ids: preview.matchingTransactions.map((item) => item.id),
        }),
      });

      const payload = await response.json();
      if (response.ok) {
        setBatchId(payload.batch_id);
      }
    } finally {
      setLoading(false);
    }
  };

  const undo = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      await fetch("/api/rules/undo-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      setBatchId(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Backfill Preview</h3>
          <button onClick={onClose} className="btn-secondary text-sm">Close</button>
        </div>

        {loading && <div className="text-sm text-slate-500">Loading…</div>}

        {!loading && preview && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="card p-3"><div className="text-slate-500">Would Change</div><div className="font-semibold">{preview.wouldChange}</div></div>
              <div className="card p-3"><div className="text-slate-500">Locked Skips</div><div className="font-semibold">{preview.wouldSkipLocked}</div></div>
              <div className="card p-3"><div className="text-slate-500">Matched</div><div className="font-semibold">{preview.totalMatching}</div></div>
            </div>

            <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.matchingTransactions.slice(0, 10).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{item.date}</td>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-primary text-sm" onClick={apply} disabled={loading}>Apply</button>
              {batchId && (
                <button className="btn-secondary text-sm" onClick={undo} disabled={loading}>
                  Undo Batch
                </button>
              )}
              {batchId && <div className="text-xs text-green-700">Applied. Batch: {batchId}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
