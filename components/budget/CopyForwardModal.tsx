"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/cashflow";

interface CopyForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMonth: string;
  destMonth: string;
  onCopyForward: (includeInflows: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function CopyForwardModal({
  isOpen,
  onClose,
  sourceMonth,
  destMonth,
  onCopyForward,
  isLoading = false,
  className = "",
}: CopyForwardModalProps) {
  const [includeInflows, setIncludeInflows] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await onCopyForward(includeInflows);
    onClose();
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            Copy Budget Forward
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                Copy budget from:
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {formatMonthDisplay(sourceMonth)}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                To:
              </p>
              <p className="font-semibold text-blue-600 dark:text-blue-400">
                {formatMonthDisplay(destMonth)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInflows}
                  onChange={(e) => setIncludeInflows(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500
                           dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-blue-600"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    Include expected inflows
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Also copy recurring income sources like rent, reimbursements, etc.
                  </div>
                </div>
              </label>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> This will replace any existing budget targets for {formatMonthDisplay(destMonth)}.
                Make sure you want to overwrite any existing data.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-150 ease-in-out"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed rounded-md
                       transition-colors duration-150 ease-in-out
                       flex items-center justify-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isLoading ? "Copying..." : "Copy Budget"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateCopyForwardProps {
  onCopyForward: (includeInflows: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function EmptyStateCopyForward({
  onCopyForward,
  isLoading = false,
  className = "",
}: EmptyStateCopyForwardProps) {
  const [includeInflows, setIncludeInflows] = useState(false);

  const handleCopy = async () => {
    await onCopyForward(includeInflows);
  };

  return (
    <div className={`card p-8 text-center ${className}`}>
      <div className="mb-6">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No Budget Yet
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Start by copying your budget from a previous month, or create budget targets manually.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="text-left">
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <input
              type="checkbox"
              checked={includeInflows}
              onChange={(e) => setIncludeInflows(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500
                       dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-blue-600"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                Also copy expected inflows
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Include recurring income sources
              </div>
            </div>
          </label>
        </div>

        <button
          onClick={handleCopy}
          disabled={isLoading}
          className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                   disabled:opacity-50 disabled:cursor-not-allowed rounded-md
                   transition-colors duration-150 ease-in-out
                   flex items-center justify-center gap-2"
        >
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isLoading ? "Copying..." : "Copy from Previous Month"}
        </button>
      </div>
    </div>
  );
}
