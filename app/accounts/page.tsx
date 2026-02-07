"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/types/database";

interface EditState {
  [id: string]: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edits, setEdits] = useState<EditState>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        const initial: EditState = {};
        (data.accounts || []).forEach((account: Account) => {
          initial[account.id] = account.display_name || account.name;
        });
        setEdits(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveLabel = async (accountId: string) => {
    const nextLabel = (edits[accountId] || "").trim();
    if (!nextLabel) return;

    setSavingId(accountId);
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: nextLabel }),
    });

    if (res.ok) {
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === accountId ? { ...account, display_name: nextLabel } : account
        )
      );
    }

    setSavingId(null);
  };

  if (loading) {
    return <div className="card p-6 text-slate-500">Loading accounts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accounts</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Connected accounts and display label management
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Institution</th>
              <th className="px-4 py-3 text-left">Provider Name</th>
              <th className="px-4 py-3 text-left">Display Label</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-3">{account.institution_name || "Unknown"}</td>
                <td className="px-4 py-3">{account.name}</td>
                <td className="px-4 py-3">
                  <input
                    className="input min-h-[44px]"
                    value={edits[account.id] || ""}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [account.id]: e.target.value }))}
                  />
                </td>
                <td className="px-4 py-3">{account.owner}</td>
                <td className="px-4 py-3">{account.subtype}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="btn-primary text-xs min-h-[44px]"
                    onClick={() => saveLabel(account.id)}
                    disabled={savingId === account.id}
                  >
                    {savingId === account.id ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
