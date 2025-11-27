"use client";

import { formatCurrency } from "@/lib/cashflow";
import type { ExpectedInflow } from "@/types/database";

interface OutstandingInflowsCardProps {
  inflows: ExpectedInflow[];
}

export function OutstandingInflowsCard({ inflows }: OutstandingInflowsCardProps) {
  const pendingInflows = inflows.filter((i) => i.status === "pending");
  const totalOutstanding = pendingInflows.reduce(
    (sum, i) => sum + (i.expected_amount - (i.actual_amount || 0)),
    0
  );
  const hasOutstanding = totalOutstanding > 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Expected Inflows
        </h2>
        {hasOutstanding && (
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full">
            {formatCurrency(totalOutstanding)} pending
          </span>
        )}
      </div>

      {/* Inflows List */}
      <div className="space-y-3">
        {inflows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No expected inflows this month
          </p>
        ) : (
          inflows.map((inflow) => {
            const outstanding = inflow.expected_amount - (inflow.actual_amount || 0);
            return (
              <div
                key={inflow.id}
                className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {inflow.source}
                  </p>
                  {inflow.expected_date && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Due: {new Date(inflow.expected_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatCurrency(inflow.expected_amount)}
                  </p>
                  <StatusBadge status={inflow.status} outstanding={outstanding} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  outstanding,
}: {
  status: ExpectedInflow["status"];
  outstanding: number;
}) {
  if (status === "received") {
    return (
      <span className="text-xs text-green-600 dark:text-green-400">
        ✓ Received
      </span>
    );
  }

  if (status === "missed") {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">
        ⚠ Missed ({formatCurrency(outstanding)})
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        Partial ({formatCurrency(outstanding)} left)
      </span>
    );
  }

  return (
    <span className="text-xs text-amber-600 dark:text-amber-400">
      Pending ({formatCurrency(outstanding)})
    </span>
  );
}
