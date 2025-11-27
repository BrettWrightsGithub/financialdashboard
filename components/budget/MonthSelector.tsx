"use client";

import { formatMonth } from "@/lib/cashflow";

interface MonthSelectorProps {
  value: string; // YYYY-MM format
  onChange: (month: string) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  // Generate last 12 months as options
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const goToPrevMonth = () => {
    const [year, month] = value.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    onChange(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`);
  };

  const goToNextMonth = () => {
    const [year, month] = value.split("-").map(Number);
    const nextDate = new Date(year, month, 1);
    onChange(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goToPrevMonth}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Previous month"
      >
        ←
      </button>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select min-w-[160px]"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonth(m)}
          </option>
        ))}
      </select>

      <button
        onClick={goToNextMonth}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
