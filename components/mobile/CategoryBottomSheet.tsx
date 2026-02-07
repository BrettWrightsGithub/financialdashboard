"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/types/database";

interface CategoryBottomSheetProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSelect: (categoryId: string) => void;
}

export function CategoryBottomSheet({ isOpen, categories, onClose, onSelect }: CategoryBottomSheetProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close category picker" />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 max-h-[70vh] overflow-auto pb-[env(safe-area-inset-bottom)]">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <input
            type="search"
            className="input min-h-[44px]"
            placeholder="Search categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="p-2 space-y-1">
          {filtered.map((category) => (
            <button
              key={category.id}
              className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
              onClick={() => {
                onSelect(category.id);
                onClose();
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
