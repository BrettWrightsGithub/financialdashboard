/**
 * Transfer Detection - Identify internal transfers and P2P transactions
 * 
 * Heuristics for detecting transfers between accounts owned by the same user.
 */

import type { Transaction } from "@/types/database";

// Known P2P services that could be transfers or external payments
const P2P_SERVICES = [
  "venmo",
  "zelle",
  "paypal",
  "cash app",
  "cashapp",
  "square cash",
  "apple cash",
  "google pay",
];

// Keywords that indicate internal bank transfers
const TRANSFER_KEYWORDS = [
  "transfer",
  "xfer",
  "ach",
  "wire",
  "internal",
  "sweep",
  "move money",
  "from savings",
  "to savings",
  "from checking",
  "to checking",
];

/**
 * Check if a merchant name matches a known P2P service.
 */
export function isKnownP2PService(merchantName: string | null): boolean {
  if (!merchantName) return false;
  const normalized = merchantName.toLowerCase();
  return P2P_SERVICES.some((service) => normalized.includes(service));
}

/**
 * Check if description contains transfer-related keywords.
 */
export function hasTransferKeywords(description: string | null): boolean {
  if (!description) return false;
  const normalized = description.toLowerCase();
  return TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Detect if a transaction is likely an internal transfer.
 * 
 * Heuristic: Same amount (opposite sign) within 3 days between same-owner accounts.
 */
export function detectInternalTransfer(
  transaction: Transaction,
  allTransactions: Transaction[],
  maxDaysDiff: number = 3
): { isTransfer: boolean; matchingTransaction?: Transaction } {
  const txDate = new Date(transaction.date);
  const txAmount = transaction.amount;

  // Look for a matching transaction with opposite sign
  for (const other of allTransactions) {
    // Skip same transaction
    if (other.id === transaction.id) continue;

    // Skip if same account (internal transfers are between different accounts)
    if (other.account_id === transaction.account_id) continue;

    // Check if amounts are opposite (one positive, one negative, same absolute value)
    const amountMatch = Math.abs(other.amount + txAmount) < 0.01; // Within 1 cent
    if (!amountMatch) continue;

    // Check if within date range
    const otherDate = new Date(other.date);
    const daysDiff = Math.abs(txDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDaysDiff) continue;

    // Found a matching transfer pair
    return { isTransfer: true, matchingTransaction: other };
  }

  // Also check for transfer keywords in description
  if (hasTransferKeywords(transaction.description_raw)) {
    return { isTransfer: true };
  }

  return { isTransfer: false };
}

/**
 * Classify a P2P transaction as transfer, expense, or income.
 * 
 * - If between same-owner accounts → transfer
 * - If external P2P outflow → expense (user can override)
 * - If external P2P inflow → income (user can override)
 */
export function classifyP2PTransaction(
  transaction: Transaction
): "transfer" | "expense" | "income" | "unknown" {
  // Check if it's a P2P service
  const isP2P =
    isKnownP2PService(transaction.counterparty_name) ||
    isKnownP2PService(transaction.description_raw);

  if (!isP2P) {
    return "unknown";
  }

  // If already marked as transfer, respect that
  if (transaction.is_transfer) {
    return "transfer";
  }

  // Classify based on amount direction
  if (transaction.amount < 0) {
    return "expense"; // Money out via P2P
  } else if (transaction.amount > 0) {
    return "income"; // Money in via P2P
  }

  return "unknown";
}

/**
 * Get suggested transfer pairs for a set of transactions.
 * Returns pairs that are likely internal transfers.
 */
export function getSuggestedTransferPairs(
  transactions: Transaction[]
): Array<{ outflow: Transaction; inflow: Transaction; confidence: number }> {
  const pairs: Array<{ outflow: Transaction; inflow: Transaction; confidence: number }> = [];
  const usedIds = new Set<string>();

  // Sort by date for consistent pairing
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    if (usedIds.has(tx.id)) continue;
    if (tx.amount >= 0) continue; // Start with outflows

    const result = detectInternalTransfer(tx, sorted);
    if (result.isTransfer && result.matchingTransaction) {
      const match = result.matchingTransaction;
      if (usedIds.has(match.id)) continue;

      usedIds.add(tx.id);
      usedIds.add(match.id);

      pairs.push({
        outflow: tx,
        inflow: match,
        confidence: 0.9, // High confidence for amount+date match
      });
    }
  }

  return pairs;
}

/**
 * Auto-detect and mark transfers in a batch of transactions.
 * Returns the IDs of transactions that were marked as transfers.
 */
export async function autoDetectTransfers(
  transactions: Transaction[]
): Promise<string[]> {
  const pairs = getSuggestedTransferPairs(transactions);
  const transferIds: string[] = [];

  for (const pair of pairs) {
    transferIds.push(pair.outflow.id, pair.inflow.id);
  }

  return transferIds;
}
