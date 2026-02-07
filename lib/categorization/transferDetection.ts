import type { Transaction } from "@/types/database";

export type TransferMatchSource = "time_window" | "provider_pattern" | "fuzzy_match";

export interface TransferDetectionConfig {
  timeWindowDays: number;
  amountTolerancePercent: number;
}

export interface TransferCandidate {
  transaction: Transaction;
  counterpart: Transaction | null;
  confidence: number;
  matchSource: TransferMatchSource;
}

const DEFAULT_CONFIG: TransferDetectionConfig = {
  timeWindowDays: 3,
  amountTolerancePercent: 1,
};

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

const PROVIDER_PATTERNS = [
  "zelle transfer",
  "zelle to self",
  "amex epayment",
  "american express ach",
  "chase transfer",
  "venmo cashout",
  "paypal transfer",
];

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function daysBetween(left: string, right: string): number {
  return Math.abs(toDate(left).getTime() - toDate(right).getTime()) / (1000 * 60 * 60 * 24);
}

function amountWithinTolerance(a: number, b: number, tolerancePercent: number): boolean {
  const baseline = Math.max(Math.abs(a), Math.abs(b));
  if (baseline === 0) return true;
  const diff = Math.abs(Math.abs(a) - Math.abs(b));
  return diff / baseline <= tolerancePercent / 100;
}

function normalizeText(text: string | null): string {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function isKnownP2PService(merchantName: string | null): boolean {
  const normalized = normalizeText(merchantName);
  if (!normalized) return false;
  return P2P_SERVICES.some((service) => normalized.includes(service));
}

export function hasTransferKeywords(description: string | null): boolean {
  const normalized = normalizeText(description);
  if (!normalized) return false;
  return TRANSFER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function matchesProviderPattern(description: string | null): boolean {
  const normalized = normalizeText(description);
  if (!normalized) return false;
  return PROVIDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function scoreTimeWindowMatch(tx: Transaction, counterpart: Transaction, config: TransferDetectionConfig): number {
  const days = daysBetween(tx.date, counterpart.date);
  const dateScore = Math.max(0, 1 - days / Math.max(config.timeWindowDays, 1));
  const amountDiff = Math.abs(Math.abs(tx.amount) - Math.abs(counterpart.amount));
  const baseline = Math.max(Math.abs(tx.amount), Math.abs(counterpart.amount), 1);
  const amountScore = 1 - Math.min(amountDiff / baseline, 1);
  return Number((0.65 * amountScore + 0.35 * dateScore).toFixed(3));
}

function findCounterpart(
  tx: Transaction,
  transactions: Transaction[],
  usedIds: Set<string>,
  config: TransferDetectionConfig
): Transaction | null {
  let best: { tx: Transaction; score: number } | null = null;

  for (const other of transactions) {
    if (other.id === tx.id || usedIds.has(other.id)) continue;
    if (other.account_id === tx.account_id) continue;
    if (tx.amount === 0 || other.amount === 0) continue;
    if (Math.sign(tx.amount) === Math.sign(other.amount)) continue;

    const withinDate = daysBetween(tx.date, other.date) <= config.timeWindowDays;
    if (!withinDate) continue;

    const amountMatch = amountWithinTolerance(tx.amount, other.amount, config.amountTolerancePercent);
    if (!amountMatch) continue;

    const score = scoreTimeWindowMatch(tx, other, config);
    if (!best || score > best.score) {
      best = { tx: other, score };
    }
  }

  return best?.tx || null;
}

export function detectTransfersByTimeWindow(
  transactions: Transaction[],
  config: Partial<TransferDetectionConfig> = {}
): TransferCandidate[] {
  const effective = { ...DEFAULT_CONFIG, ...config };
  const sorted = [...transactions].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  const usedIds = new Set<string>();
  const candidates: TransferCandidate[] = [];

  for (const tx of sorted) {
    if (usedIds.has(tx.id)) continue;
    if (tx.is_transfer) continue;

    const counterpart = findCounterpart(tx, sorted, usedIds, effective);
    if (!counterpart) continue;

    const confidence = scoreTimeWindowMatch(tx, counterpart, effective);
    candidates.push({
      transaction: tx,
      counterpart,
      confidence,
      matchSource: "time_window",
    });

    usedIds.add(tx.id);
    usedIds.add(counterpart.id);
  }

  return candidates;
}

export function detectTransfersByProviderPattern(transactions: Transaction[]): TransferCandidate[] {
  return transactions
    .filter((tx) => !tx.is_transfer && matchesProviderPattern(tx.description_raw))
    .map((tx) => ({
      transaction: tx,
      counterpart: null,
      confidence: 0.95,
      matchSource: "provider_pattern" as const,
    }));
}

export function detectTransfersByFuzzyMatch(
  transactions: Transaction[],
  config: Partial<TransferDetectionConfig> = {}
): TransferCandidate[] {
  const effective = { ...DEFAULT_CONFIG, ...config };
  const grouped: Record<string, Transaction[]> = {};

  for (const tx of transactions) {
    const key = normalizeText(tx.counterparty_name || tx.description_raw).slice(0, 24);
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }

  const used = new Set<string>();
  const candidates: TransferCandidate[] = [];

  for (const group of Object.values(grouped)) {
    const inflows = group.filter((tx) => tx.amount > 0 && !used.has(tx.id));
    const outflows = group.filter((tx) => tx.amount < 0 && !used.has(tx.id));

    for (const inflow of inflows) {
      const counterpart = outflows.find((outflow) =>
        amountWithinTolerance(inflow.amount, outflow.amount, 2) &&
        daysBetween(inflow.date, outflow.date) <= effective.timeWindowDays &&
        inflow.account_id !== outflow.account_id
      );

      if (!counterpart) continue;

      used.add(inflow.id);
      used.add(counterpart.id);
      candidates.push({
        transaction: inflow,
        counterpart,
        confidence: 0.75,
        matchSource: "fuzzy_match",
      });
    }
  }

  return candidates;
}

export function detectTransferCandidates(
  transactions: Transaction[],
  config: Partial<TransferDetectionConfig> = {}
): TransferCandidate[] {
  const timeWindow = detectTransfersByTimeWindow(transactions, config);
  const provider = detectTransfersByProviderPattern(transactions);
  const fuzzy = detectTransfersByFuzzyMatch(transactions, config);

  const byId = new Map<string, TransferCandidate>();

  for (const candidate of [...timeWindow, ...provider, ...fuzzy]) {
    const id = candidate.transaction.id;
    const existing = byId.get(id);
    if (!existing || candidate.confidence > existing.confidence) {
      byId.set(id, candidate);
    }
  }

  return [...byId.values()].sort((a, b) => b.confidence - a.confidence);
}

export function detectInternalTransfer(
  transaction: Transaction,
  allTransactions: Transaction[],
  maxDaysDiff: number = 3
): { isTransfer: boolean; matchingTransaction?: Transaction } {
  const candidates = detectTransfersByTimeWindow(allTransactions, {
    timeWindowDays: maxDaysDiff,
  });

  const direct = candidates.find((candidate) => candidate.transaction.id === transaction.id);
  if (direct?.counterpart) {
    return { isTransfer: true, matchingTransaction: direct.counterpart };
  }

  const reverse = candidates.find((candidate) => candidate.counterpart?.id === transaction.id);
  if (reverse) {
    return { isTransfer: true, matchingTransaction: reverse.transaction };
  }

  if (hasTransferKeywords(transaction.description_raw) || matchesProviderPattern(transaction.description_raw)) {
    return { isTransfer: true };
  }

  return { isTransfer: false };
}

export function classifyP2PTransaction(
  transaction: Transaction
): "transfer" | "expense" | "income" | "unknown" {
  const isP2P =
    isKnownP2PService(transaction.counterparty_name) ||
    isKnownP2PService(transaction.description_raw);

  if (!isP2P) return "unknown";
  if (transaction.is_transfer) return "transfer";
  if (transaction.amount < 0) return "expense";
  if (transaction.amount > 0) return "income";
  return "unknown";
}

export function getSuggestedTransferPairs(
  transactions: Transaction[]
): Array<{ outflow: Transaction; inflow: Transaction; confidence: number }> {
  const candidates = detectTransferCandidates(transactions).filter(
    (candidate) => candidate.counterpart && candidate.transaction.amount < 0
  );

  return candidates.map((candidate) => ({
    outflow: candidate.transaction,
    inflow: candidate.counterpart as Transaction,
    confidence: candidate.confidence,
  }));
}

export async function autoDetectTransfers(
  transactions: Transaction[]
): Promise<string[]> {
  const pairs = getSuggestedTransferPairs(transactions);
  const ids: string[] = [];

  for (const pair of pairs) {
    ids.push(pair.outflow.id, pair.inflow.id);
  }

  return ids;
}
