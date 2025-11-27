"use client";

import { formatCurrency } from "@/lib/cashflow";
import type { OutstandingInflow } from "@/types/database";

// TODO: Replace with real data from Supabase
const MOCK_INFLOWS: OutstandingInflow[] = [
  {
    id: "1",
    counterpartyName: "Stephani Walker",
    description: "Eagle Mt Rent",
    expected: 1400,
    received: 1400,
    outstanding: 0,
    status: "received",
  },
  {
    id: "2",
    counterpartyName: "Rachel McBeth",
    description: "Eagle Mt Rent",
    expected: 700,
    received: 350,
    outstanding: 350,
    status: "pending",
  },
  {
    id: "3",
    counterpartyName: "Fife",
    description: "T-Mobile Share",
    expected: 45,
    received: 0,
    outstanding: 45,
    status: "overdue",
  },
];

export function OutstandingInflowsCard() {
  const totalOutstanding = MOCK_INFLOWS.reduce((sum, i) => sum + i.outstanding, 0);
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
        {MOCK_INFLOWS.map((inflow) => (
          <div
            key={inflow.id}
            className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {inflow.counterpartyName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {inflow.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {formatCurrency(inflow.expected)}
              </p>
              <StatusBadge status={inflow.status} outstanding={inflow.outstanding} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  outstanding,
}: {
  status: OutstandingInflow["status"];
  outstanding: number;
}) {
  if (status === "received") {
    return (
      <span className="text-xs text-green-600 dark:text-green-400">
        ✓ Received
      </span>
    );
  }

  if (status === "overdue") {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">
        ⚠ Overdue ({formatCurrency(outstanding)})
      </span>
    );
  }

  return (
    <span className="text-xs text-amber-600 dark:text-amber-400">
      Pending ({formatCurrency(outstanding)})
    </span>
  );
}
