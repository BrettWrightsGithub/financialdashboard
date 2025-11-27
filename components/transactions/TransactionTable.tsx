"use client";

import { useState } from "react";
import { formatCurrencyPrecise } from "@/lib/cashflow";
import type { TransactionWithDetails, TransactionFilters, CashflowGroup } from "@/types/database";

interface TransactionTableProps {
  filters: TransactionFilters;
}

// TODO: Replace with real data from Supabase
const MOCK_TRANSACTIONS: TransactionWithDetails[] = [
  {
    id: "1",
    provider: "plaid",
    provider_transaction_id: "txn_1",
    account_id: "1",
    provider_account_id: "acc_1",
    date: "2025-11-25",
    amount: -156.42,
    description_raw: "COSTCO WHSE #1234 LEHI UT",
    description_clean: "Costco",
    life_category_id: "cat_1",
    cashflow_group: "Variable Essentials",
    flow_type: "Expense",
    category_ai: "Groceries",
    category_ai_conf: 0.95,
    category_locked: false,
    status: "posted",
    provider_type: "card_payment",
    processing_status: "complete",
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    created_at: "2025-11-25T10:00:00Z",
    updated_at: "2025-11-25T10:00:00Z",
    account_name: "Chase Credit Card",
    category_name: "Groceries",
  },
  {
    id: "2",
    provider: "venmo",
    provider_transaction_id: "txn_2",
    account_id: "3",
    provider_account_id: "venmo_1",
    date: "2025-11-24",
    amount: 1400,
    description_raw: "Stephani Walker paid you $1400.00",
    description_clean: "Stephani Walker",
    life_category_id: "cat_2",
    cashflow_group: "Income",
    flow_type: "Income",
    category_ai: "Rental Income",
    category_ai_conf: 0.92,
    category_locked: true,
    status: "posted",
    provider_type: null,
    processing_status: "complete",
    counterparty_name: "Stephani Walker",
    counterparty_id: "cp_1",
    is_transfer: false,
    is_pass_through: false,
    is_business: true,
    created_at: "2025-11-24T15:30:00Z",
    updated_at: "2025-11-24T15:30:00Z",
    account_name: "Venmo",
    category_name: "Rental Income",
  },
  {
    id: "3",
    provider: "plaid",
    provider_transaction_id: "txn_3",
    account_id: "1",
    provider_account_id: "acc_1",
    date: "2025-11-23",
    amount: -23.45,
    description_raw: "TST* CHIPOTLE 1234",
    description_clean: "Chipotle",
    life_category_id: "cat_3",
    cashflow_group: "Discretionary",
    flow_type: "Expense",
    category_ai: "Dining Out",
    category_ai_conf: 0.98,
    category_locked: false,
    status: "posted",
    provider_type: "card_payment",
    processing_status: "complete",
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    created_at: "2025-11-23T12:15:00Z",
    updated_at: "2025-11-23T12:15:00Z",
    account_name: "Chase Credit Card",
    category_name: "Dining Out",
  },
  {
    id: "4",
    provider: "plaid",
    provider_transaction_id: "txn_4",
    account_id: "1",
    provider_account_id: "acc_1",
    date: "2025-11-22",
    amount: -500,
    description_raw: "TRANSFER TO SAVINGS",
    description_clean: "Transfer to Savings",
    life_category_id: "cat_4",
    cashflow_group: "Transfer",
    flow_type: "Transfer",
    category_ai: "Transfer",
    category_ai_conf: 1.0,
    category_locked: false,
    status: "posted",
    provider_type: "transfer",
    processing_status: "complete",
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: true,
    is_pass_through: false,
    is_business: false,
    created_at: "2025-11-22T09:00:00Z",
    updated_at: "2025-11-22T09:00:00Z",
    account_name: "AFCU Checking",
    category_name: "Transfer",
  },
];

// TODO: Get from Supabase
const MOCK_CATEGORIES = [
  { id: "cat_1", name: "Groceries" },
  { id: "cat_2", name: "Rental Income" },
  { id: "cat_3", name: "Dining Out" },
  { id: "cat_4", name: "Transfer" },
  { id: "cat_5", name: "Salary" },
  { id: "cat_6", name: "Shopping" },
  { id: "cat_7", name: "Entertainment" },
  { id: "cat_8", name: "Gas/Fuel" },
];

export function TransactionTable({ filters }: TransactionTableProps) {
  // Apply filters
  let filtered = MOCK_TRANSACTIONS.filter((t) => {
    if (t.date < filters.dateRange.start || t.date > filters.dateRange.end) return false;
    if (filters.accountId && t.account_id !== filters.accountId) return false;
    if (filters.cashflowGroup && t.cashflow_group !== filters.cashflowGroup) return false;
    if (filters.hideTransfers && t.is_transfer) return false;
    if (filters.hidePassThrough && t.is_pass_through) return false;
    return true;
  });

  // Sort by date descending
  filtered = filtered.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No transactions found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination placeholder */}
      {filtered.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Showing {filtered.length} transactions</span>
          <div className="flex gap-2">
            {/* TODO: Add pagination controls */}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: TransactionWithDetails }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(transaction.life_category_id);

  const isIncome = transaction.amount >= 0;

  const handleCategoryChange = (newCategoryId: string) => {
    setSelectedCategory(newCategoryId);
    // TODO: Update in Supabase and create category_override
    setIsEditing(false);
  };

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      {/* Date */}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {new Date(transaction.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {transaction.description_clean || transaction.description_raw}
        </div>
        {transaction.counterparty_name && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {transaction.counterparty_name}
          </div>
        )}
      </td>

      {/* Category (Editable) */}
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            value={selectedCategory || ""}
            onChange={(e) => handleCategoryChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="select text-sm py-1"
          >
            {MOCK_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            {transaction.category_name}
            {transaction.category_locked && (
              <span className="text-xs" title="Manually set">🔒</span>
            )}
          </button>
        )}
      </td>

      {/* Account */}
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        {transaction.account_name}
      </td>

      {/* Amount */}
      <td className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${
        isIncome ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"
      }`}>
        {isIncome ? "+" : ""}
        {formatCurrencyPrecise(transaction.amount)}
      </td>

      {/* Flags */}
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1">
          {transaction.is_transfer && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" title="Transfer">
              T
            </span>
          )}
          {transaction.is_pass_through && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300" title="Pass-Through">
              P
            </span>
          )}
          {transaction.is_business && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" title="Business">
              B
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
