/**
 * Plaid Sync - TypeScript wrappers for sync status and triggers
 * 
 * The actual sync logic runs in n8n. This module provides:
 * - Status queries from sync_state table
 * - Manual sync trigger via n8n webhook
 */

import { createServerSupabaseClient } from "../supabase";

export interface SyncState {
  id: string;
  accountId: string | null;
  connectionId: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "error" | "in_progress";
  lastError: string | null;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
}

export interface SyncSummary {
  lastSyncAt: string | null;
  status: "success" | "error" | "in_progress" | "never";
  accountsSynced: number;
  recentTransactions: {
    added: number;
    modified: number;
    removed: number;
  };
}

/**
 * Get sync status for a specific account.
 */
export async function getSyncStatus(accountId: string): Promise<SyncState | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sync_state")
    .select("*")
    .eq("account_id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    accountId: data.account_id,
    connectionId: data.connection_id,
    cursor: data.cursor,
    lastSyncAt: data.last_sync_at,
    lastSyncStatus: data.last_sync_status,
    lastError: data.last_error,
    transactionsAdded: data.transactions_added || 0,
    transactionsModified: data.transactions_modified || 0,
    transactionsRemoved: data.transactions_removed || 0,
  };
}

/**
 * Get overall sync summary across all accounts.
 */
export async function getSyncSummary(): Promise<SyncSummary> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("sync_state")
    .select("*")
    .order("last_sync_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return {
      lastSyncAt: null,
      status: "never",
      accountsSynced: 0,
      recentTransactions: { added: 0, modified: 0, removed: 0 },
    };
  }

  // Find most recent sync
  const mostRecent = data[0];
  
  // Aggregate transaction counts from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentSyncs = data.filter(
    (s) => s.last_sync_at && s.last_sync_at > oneDayAgo
  );

  const recentTransactions = recentSyncs.reduce(
    (acc, s) => ({
      added: acc.added + (s.transactions_added || 0),
      modified: acc.modified + (s.transactions_modified || 0),
      removed: acc.removed + (s.transactions_removed || 0),
    }),
    { added: 0, modified: 0, removed: 0 }
  );

  // Determine overall status
  const hasError = data.some((s) => s.last_sync_status === "error");
  const inProgress = data.some((s) => s.last_sync_status === "in_progress");

  return {
    lastSyncAt: mostRecent.last_sync_at,
    status: inProgress ? "in_progress" : hasError ? "error" : "success",
    accountsSynced: data.length,
    recentTransactions,
  };
}

/**
 * Get the last sync time across all accounts.
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const summary = await getSyncSummary();
  return summary.lastSyncAt ? new Date(summary.lastSyncAt) : null;
}

/**
 * Trigger a manual sync via n8n webhook.
 * Returns immediately - sync runs asynchronously.
 */
export async function triggerSync(options?: {
  accountId?: string;
  connectionId?: string;
}): Promise<{ triggered: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_SYNC_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("N8N_SYNC_WEBHOOK_URL not configured");
    return { triggered: false, error: "Sync webhook not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger: "manual",
        accountId: options?.accountId,
        connectionId: options?.connectionId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }

    return { triggered: true };
  } catch (error) {
    console.error("Failed to trigger sync:", error);
    return {
      triggered: false,
      error: error instanceof Error ? error.message : "Failed to trigger sync",
    };
  }
}

/**
 * Update sync state after a sync operation (called by n8n or internal processes).
 */
export async function updateSyncState(
  connectionId: string,
  update: {
    cursor?: string;
    status: "success" | "error" | "in_progress";
    error?: string;
    transactionsAdded?: number;
    transactionsModified?: number;
    transactionsRemoved?: number;
  }
): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("sync_state")
    .upsert({
      connection_id: connectionId,
      cursor: update.cursor,
      last_sync_at: new Date().toISOString(),
      last_sync_status: update.status,
      last_error: update.error || null,
      transactions_added: update.transactionsAdded || 0,
      transactions_modified: update.transactionsModified || 0,
      transactions_removed: update.transactionsRemoved || 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "connection_id",
    });

  if (error) {
    console.error("Failed to update sync state:", error);
    return false;
  }

  return true;
}
