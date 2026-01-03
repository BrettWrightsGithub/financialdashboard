"use client";

import type { Category } from "@/types/database";

interface GroupedCategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Category dropdown organized into logical groups:
 * - Transfer (top for quick access)
 * - Inbound (Income categories)
 * - Outbound (Expense categories)
 * 
 * Uses cashflow_group as primary grouping since flow_type may not always be populated.
 */
export function GroupedCategorySelect({
  categories,
  value,
  onChange,
  placeholder = "Select category...",
  className = "select text-sm py-1",
  disabled = false,
}: GroupedCategorySelectProps) {
  // Group categories primarily by cashflow_group, with Transfer at top
  // Transfer group
  const transferCats = categories.filter(c => 
    c.cashflow_group === "Transfer" || c.flow_type === "Transfer"
  );
  
  // Income group - Income cashflow_group or Income flow_type
  const incomeCats = categories.filter(c => 
    c.cashflow_group === "Income" || 
    (c.flow_type === "Income" && c.cashflow_group !== "Transfer")
  );
  
  // Expense/Outbound group - everything else that's not Transfer or Income
  const expenseCats = categories.filter(c => 
    c.cashflow_group !== "Transfer" && 
    c.cashflow_group !== "Income" &&
    c.flow_type !== "Transfer" &&
    c.flow_type !== "Income"
  );

  // Sort each group by sort_order then name
  const sortCats = (cats: Category[]) => 
    [...cats].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));

  const sortedTransfer = sortCats(transferCats);
  const sortedIncome = sortCats(incomeCats);
  const sortedExpense = sortCats(expenseCats);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      
      {sortedTransfer.length > 0 && (
        <optgroup label="⇄ Transfer">
          {sortedTransfer.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      )}
      
      {sortedIncome.length > 0 && (
        <optgroup label="↓ Inbound (Income)">
          {sortedIncome.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      )}
      
      {sortedExpense.length > 0 && (
        <optgroup label="↑ Outbound (Expenses)">
          {sortedExpense.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
