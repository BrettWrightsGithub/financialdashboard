/**
 * Transfer Detection - Identify internal transfers and P2P transactions
 *
 * Heuristics for detecting transfers between accounts owned by the same user.
 * Enhanced with confidence scoring, provider patterns, and fuzzy matching.
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

// Provider-specific transfer patterns
const PROVIDER_PATTERNS = [
  { pattern: /zelle.*to\s+self/i, confidence: 0.95 },
  { pattern: /zelle.*from\s+self/i, confidence: 0.95 },
  { pattern: /(amex|american\s+express).*payment/i, confidence: 0.9 },
  { pattern: /chase.*transfer/i, confidence: 0.9 },
  { pattern: /bank\s+of\s+america.*transfer/i, confidence: 0.9 },
  { pattern: /wells\s+fargo.*transfer/i, confidence: 0.9 },
  { pattern: /credit\s+card\s+payment/i, confidence: 0.85 },
  { pattern: /online\s+transfer/i, confidence: 0.8 },
  { pattern: /mobile\s+transfer/i, confidence: 0.8 },
];

export interface TransferDetectionConfig {
  maxDaysDiff: number;
  amountTolerancePercent: number;
  amountToleranceCents: number;
}

export const DEFAULT_CONFIG: TransferDetectionConfig = {
  maxDaysDiff: 3,
  amountTolerancePercent: 1, // 1% tolerance for fees
  amountToleranceCents: 1, // 1 cent tolerance for rounding
};

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
 * Check provider-specific patterns and return confidence score.
 */
export function matchProviderPattern(description: string | null): number {
  if (!description) return 0;

  for (const { pattern, confidence } of PROVIDER_PATTERNS) {
    if (pattern.test(description)) {
      return confidence;
    }
  }

  return 0;
}

/**
 * Check if two amounts match within tolerance (for handling fees).
 */
export function amountsMatchWithTolerance(
  amount1: number,
  amount2: number,
  config: TransferDetectionConfig = DEFAULT_CONFIG
): { matches: boolean; confidence: number } {
  const sum = Math.abs(amount1 + amount2);
  const larger = Math.max(Math.abs(amount1), Math.abs(amount2));

  // Check cent tolerance first (exact or near-exact match)
  if (sum <= config.amountToleranceCents / 100) {
    return { matches: true, confidence: 0.95 }; // Very high confidence
  }

  // Check percentage tolerance (for fees like Venmo instant transfer)
  const percentDiff = (sum / larger) * 100;
  if (percentDiff <= config.amountTolerancePercent) {
    return { matches: true, confidence: 0.8 }; // Good confidence with fee
  }

  return { matches: false, confidence: 0 };
}

/**
 * Detect if a transaction is likely an internal transfer.
 *
 * Enhanced heuristic with confidence scoring:
 * - Amount matching with tolerance (for fees)
 * - Date proximity (within 3 days default)
 * - Provider-specific patterns
 * - Transfer keywords in description
 */
export function detectInternalTransfer(
  transaction: Transaction,
  allTransactions: Transaction[],
  config: TransferDetectionConfig = DEFAULT_CONFIG
): {
  isTransfer: boolean;
  matchingTransaction?: Transaction;
  confidence: number;
} {
  const txDate = new Date(transaction.date);
  const txAmount = transaction.amount;
  let maxConfidence = 0;
  let bestMatch: Transaction | undefined;

  // Look for a matching transaction with opposite sign
  for (const other of allTransactions) {
    // Skip same transaction
    if (other.id === transaction.id) continue;

    // Skip if same account (internal transfers are between different accounts)
    if (other.account_id === transaction.account_id) continue;

    // Check if amounts match within tolerance
    const amountCheck = amountsMatchWithTolerance(
      txAmount,
      other.amount,
      config
    );
    if (!amountCheck.matches) continue;

    // Check if within date range
    const otherDate = new Date(other.date);
    const daysDiff =
      Math.abs(txDate.getTime() - otherDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysDiff > config.maxDaysDiff) continue;

    // Calculate confidence based on multiple factors
    let confidence = amountCheck.confidence;

    // Bonus for same-day transfers
    if (daysDiff < 1) {
      confidence = Math.min(1, confidence + 0.05);
    }

    // Check for provider patterns in both descriptions
    const patternConf1 = matchProviderPattern(transaction.description_raw);
    const patternConf2 = matchProviderPattern(other.description_raw);
    if (patternConf1 > 0 || patternConf2 > 0) {
      confidence = Math.max(confidence, Math.max(patternConf1, patternConf2));
    }

    // Check for transfer keywords
    const hasKeywords1 = hasTransferKeywords(transaction.description_raw);
    const hasKeywords2 = hasTransferKeywords(other.description_raw);
    if (hasKeywords1 || hasKeywords2) {
      confidence = Math.min(1, confidence + 0.1);
    }

    // Track best match
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      bestMatch = other;
    }
  }

  // If we found a high-confidence match, return it
  if (maxConfidence >= 0.7 && bestMatch) {
    return {
      isTransfer: true,
      matchingTransaction: bestMatch,
      confidence: maxConfidence,
    };
  }

  // Check for standalone transfer indicators (keywords or provider patterns)
  const patternConf = matchProviderPattern(transaction.description_raw);
  if (patternConf >= 0.8) {
    return { isTransfer: true, confidence: patternConf };
  }

  if (hasTransferKeywords(transaction.description_raw)) {
    return { isTransfer: true, confidence: 0.7 };
  }

  return { isTransfer: false, confidence: 0 };
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
 * Returns pairs that are likely internal transfers with confidence scores.
 */
export function getSuggestedTransferPairs(
  transactions: Transaction[],
  config: TransferDetectionConfig = DEFAULT_CONFIG,
  minConfidence: number = 0.7
): Array<{
  outflow: Transaction;
  inflow: Transaction;
  confidence: number;
}> {
  const pairs: Array<{
    outflow: Transaction;
    inflow: Transaction;
    confidence: number;
  }> = [];
  const usedIds = new Set<string>();

  // Sort by date for consistent pairing
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    if (usedIds.has(tx.id)) continue;
    if (tx.amount >= 0) continue; // Start with outflows

    const result = detectInternalTransfer(tx, sorted, config);
    if (
      result.isTransfer &&
      result.matchingTransaction &&
      result.confidence >= minConfidence
    ) {
      const match = result.matchingTransaction;
      if (usedIds.has(match.id)) continue;

      usedIds.add(tx.id);
      usedIds.add(match.id);

      pairs.push({
        outflow: tx,
        inflow: match,
        confidence: result.confidence,
      });
    }
  }

  return pairs;
}

/**
 * Auto-detect and mark transfers in a batch of transactions.
 * Returns pairs with IDs and confidence scores.
 */
export function autoDetectTransfers(
  transactions: Transaction[],
  config: TransferDetectionConfig = DEFAULT_CONFIG,
  minConfidence: number = 0.7
): Array<{
  outflowId: string;
  inflowId: string;
  confidence: number;
}> {
  const pairs = getSuggestedTransferPairs(transactions, config, minConfidence);

  return pairs.map((pair) => ({
    outflowId: pair.outflow.id,
    inflowId: pair.inflow.id,
    confidence: pair.confidence,
  }));
}
