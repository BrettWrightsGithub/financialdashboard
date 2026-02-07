"use client";

import { ChatAssistant } from "@/components/assistant/ChatAssistant";
import type { TransactionWithDetails } from "@/types/database";

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTransaction?: TransactionWithDetails | null;
}

export function AssistantDrawer({ isOpen, onClose, selectedTransaction }: AssistantDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close assistant" />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 pb-[env(safe-area-inset-bottom)]">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="font-semibold text-sm">Assistant</div>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="p-3">
          <ChatAssistant selectedTransaction={selectedTransaction} />
        </div>
      </div>
    </div>
  );
}
