"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrencyPrecise, getCurrentMonth } from "@/lib/cashflow";
import type { TransactionWithDetails, Category } from "@/types/database";
import { GroupedCategorySelect } from "@/components/transactions/GroupedCategorySelect";

export default function ReviewQueuePage() {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set()); // Track processed items
  const [sortBy, setSortBy] = useState<"date" | "confidence" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set()); // Track items currently saving
  const [showProcessed, setShowProcessed] = useState(true); // Toggle to hide processed
  const [searchFilter, setSearchFilter] = useState(""); // Text filter

  const fetchData = async () => {
    setLoading(true);
    try {
      const [queueRes, catRes] = await Promise.all([
        fetch(`/api/review-queue?sortBy=${sortBy}&sortOrder=${sortOrder}`),
        fetch("/api/categories"),
      ]);

      if (queueRes.ok) {
        const data = await queueRes.json();
        setTransactions(data.transactions || []);
      }

      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to fetch review queue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sortBy, sortOrder]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleBulkAssignCategory = async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/transactions/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_category",
          transaction_ids: Array.from(selectedIds),
          category_id: bulkCategoryId,
          learn_payee: true,
        }),
      });

      if (res.ok) {
        // Mark as processed instead of refetching
        setProcessedIds(prev => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
        setBulkCategoryId("");
      }
    } catch (error) {
      console.error("Bulk assign failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkMarkTransfer = async () => {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/transactions/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_flags",
          transaction_ids: Array.from(selectedIds),
          flags: { is_transfer: true },
        }),
      });

      if (res.ok) {
        setProcessedIds(prev => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error("Bulk mark transfer failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/transactions/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          transaction_ids: Array.from(selectedIds),
        }),
      });

      if (res.ok) {
        setProcessedIds(prev => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error("Bulk approve failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickCategory = async (transactionId: string, categoryId: string) => {
    // Add to saving state immediately
    setSavingIds(prev => new Set([...prev, transactionId]));
    try {
      const res = await fetch(`/api/transactions/${transactionId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, learn_payee: true }),
      });

      if (res.ok) {
        // Update the local transaction state with the new category
        const selectedCat = categories.find(c => c.id === categoryId);
        setTransactions(prev => prev.map(t => 
          t.id === transactionId 
            ? { ...t, life_category_id: categoryId, category_name: selectedCat?.name || t.category_name }
            : t
        ));
        setProcessedIds(prev => new Set([...prev, transactionId]));
      }
    } catch (error) {
      console.error("Quick category failed:", error);
    } finally {
      // Remove from saving state
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Review Queue
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Transactions needing your attention
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-4 flex-wrap">
        <div className="card px-4 py-3">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {transactions.filter(t => !processedIds.has(t.id)).length}
          </div>
          <div className="text-sm text-slate-500">Need Review</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-2xl font-bold text-amber-600">
            {transactions.filter((t) => !t.life_category_id && !processedIds.has(t.id)).length}
          </div>
          <div className="text-sm text-slate-500">Uncategorized</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-2xl font-bold text-green-600">
            {processedIds.size}
          </div>
          <div className="text-sm text-slate-500">Processed</div>
        </div>
        {processedIds.size > 0 && (
          <div className="card px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setShowProcessed(!showProcessed)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showProcessed ? "Hide" : "Show"} Processed
            </button>
            <button
              onClick={() => {
                setProcessedIds(new Set());
                fetchData();
              }}
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-red-600"
            >
              Clear & Refresh
            </button>
          </div>
        )}
      </div>

      {/* Filter & Sort Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by description, account, or category..."
            className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <label className="text-sm text-slate-600 dark:text-slate-400">Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="select text-sm py-1"
        >
          <option value="date">Date</option>
          <option value="confidence">Confidence</option>
          <option value="amount">Amount</option>
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
          className="select text-sm py-1"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="card px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {selectedIds.size} selected
          </span>

          <div className="flex items-center gap-2">
            <GroupedCategorySelect
              categories={categories}
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              placeholder="Assign category..."
              className="select text-sm py-1"
            />
            <button
              onClick={handleBulkAssignCategory}
              disabled={!bulkCategoryId || processing}
              className="btn btn-primary text-sm py-1 px-3 disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          <button
            onClick={handleBulkMarkTransfer}
            disabled={processing}
            className="btn text-sm py-1 px-3 bg-slate-600 text-white hover:bg-slate-700"
          >
            Mark as Transfer
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Transaction Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Current Category</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <div className="text-4xl mb-2">🎉</div>
                    All caught up! No transactions need review.
                  </td>
                </tr>
              ) : (
                transactions
                  .filter(t => showProcessed || !processedIds.has(t.id))
                  .filter(t => {
                    if (!searchFilter.trim()) return true;
                    const search = searchFilter.toLowerCase();
                    return (
                      (t.description_clean || t.description_raw || "").toLowerCase().includes(search) ||
                      (t.account_name || "").toLowerCase().includes(search) ||
                      (t.category_name || "").toLowerCase().includes(search) ||
                      (t.counterparty_name || "").toLowerCase().includes(search)
                    );
                  })
                  .map((t) => {
                  const isProcessed = processedIds.has(t.id);
                  const isSaving = savingIds.has(t.id);
                  return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      selectedIds.has(t.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    } ${isProcessed ? "bg-green-50 dark:bg-green-900/10 opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      {isProcessed ? (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {t.description_clean || t.description_raw}
                      </div>
                      <div className="text-xs text-slate-500">{t.account_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {t.category_name ? (
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {t.category_name}
                        </span>
                      ) : (
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          Uncategorized
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.category_confidence != null ? (
                        <span
                          className={`text-sm ${
                            (t.category_confidence ?? 0) >= 0.7
                              ? "text-green-600"
                              : (t.category_confidence ?? 0) >= 0.5
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {Math.round((t.category_confidence ?? 0) * 100)}%
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${
                        t.amount >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {formatCurrencyPrecise(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {isSaving ? (
                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        <GroupedCategorySelect
                          categories={categories}
                          value=""
                          onChange={(categoryId) => {
                            if (categoryId) {
                              handleQuickCategory(t.id, categoryId);
                            }
                          }}
                          placeholder="Assign..."
                          className="select text-xs py-1"
                          disabled={isProcessed}
                        />
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
