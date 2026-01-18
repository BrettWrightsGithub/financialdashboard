import {
  isKnownP2PService,
  hasTransferKeywords,
  matchProviderPattern,
  amountsMatchWithTolerance,
  detectInternalTransfer,
  classifyP2PTransaction,
  getSuggestedTransferPairs,
  autoDetectTransfers,
  DEFAULT_CONFIG,
} from "./transferDetection";
import type { Transaction } from "@/types/database";

// Helper to create mock transactions
function createMockTransaction(
  overrides: Partial<Transaction> = {}
): Transaction {
  return {
    id: `tx-${Math.random().toString(36).substr(2, 9)}`,
    provider: "plaid",
    provider_transaction_id: "test-123",
    account_id: "account-1",
    provider_account_id: "prov-account-1",
    date: "2025-01-15",
    amount: -100,
    description_raw: "Test transaction",
    description_clean: null,
    life_category_id: null,
    cashflow_group: null,
    flow_type: null,
    category_ai: null,
    category_ai_conf: null,
    category_locked: false,
    status: "posted",
    provider_type: null,
    processing_status: null,
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    category_source: null,
    parent_transaction_id: null,
    is_split_child: false,
    is_split_parent: false,
    transfer_pair_id: null,
    transfer_confidence: null,
    created_at: "2025-01-15T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
    ...overrides,
  } as Transaction;
}

describe("Transfer Detection", () => {
  describe("isKnownP2PService", () => {
    it("returns true for Venmo", () => {
      expect(isKnownP2PService("Venmo")).toBe(true);
      expect(isKnownP2PService("VENMO PAYMENT")).toBe(true);
      expect(isKnownP2PService("Payment via Venmo")).toBe(true);
    });

    it("returns true for Zelle", () => {
      expect(isKnownP2PService("Zelle Transfer")).toBe(true);
      expect(isKnownP2PService("ZELLE")).toBe(true);
    });

    it("returns true for PayPal", () => {
      expect(isKnownP2PService("PayPal")).toBe(true);
      expect(isKnownP2PService("PAYPAL TRANSFER")).toBe(true);
    });

    it("returns true for Cash App", () => {
      expect(isKnownP2PService("Cash App")).toBe(true);
      expect(isKnownP2PService("CASHAPP")).toBe(true);
      expect(isKnownP2PService("Square Cash")).toBe(true);
    });

    it("returns true for Apple Cash and Google Pay", () => {
      expect(isKnownP2PService("Apple Cash")).toBe(true);
      expect(isKnownP2PService("Google Pay Transfer")).toBe(true);
    });

    it("returns false for null input", () => {
      expect(isKnownP2PService(null)).toBe(false);
    });

    it("returns false for non-P2P merchants", () => {
      expect(isKnownP2PService("Amazon")).toBe(false);
      expect(isKnownP2PService("Walmart")).toBe(false);
      expect(isKnownP2PService("Starbucks")).toBe(false);
    });
  });

  describe("hasTransferKeywords", () => {
    it("returns true for transfer keywords", () => {
      expect(hasTransferKeywords("ACH Transfer")).toBe(true);
      expect(hasTransferKeywords("Wire Transfer")).toBe(true);
      expect(hasTransferKeywords("Internal XFER")).toBe(true);
      expect(hasTransferKeywords("From Savings")).toBe(true);
      expect(hasTransferKeywords("To Checking Account")).toBe(true);
      expect(hasTransferKeywords("Sweep to savings")).toBe(true);
    });

    it("returns false for null input", () => {
      expect(hasTransferKeywords(null)).toBe(false);
    });

    it("returns false for regular transactions", () => {
      expect(hasTransferKeywords("Amazon Purchase")).toBe(false);
      expect(hasTransferKeywords("Starbucks Coffee")).toBe(false);
      expect(hasTransferKeywords("Payroll Deposit")).toBe(false);
    });
  });

  describe("matchProviderPattern", () => {
    it("matches Zelle to/from self with high confidence", () => {
      expect(matchProviderPattern("Zelle to Self")).toBe(0.95);
      expect(matchProviderPattern("ZELLE FROM SELF")).toBe(0.95);
    });

    it("matches Amex payment with high confidence", () => {
      expect(matchProviderPattern("Amex Payment")).toBe(0.9);
      expect(matchProviderPattern("AMERICAN EXPRESS PAYMENT")).toBe(0.9);
    });

    it("matches Chase transfer", () => {
      expect(matchProviderPattern("Chase Transfer")).toBe(0.9);
      expect(matchProviderPattern("CHASE ONLINE TRANSFER")).toBe(0.9);
    });

    it("matches credit card payment", () => {
      expect(matchProviderPattern("Credit Card Payment")).toBe(0.85);
    });

    it("matches online/mobile transfer", () => {
      expect(matchProviderPattern("Online Transfer")).toBe(0.8);
      expect(matchProviderPattern("Mobile Transfer")).toBe(0.8);
    });

    it("returns 0 for non-matching descriptions", () => {
      expect(matchProviderPattern("Amazon Purchase")).toBe(0);
      expect(matchProviderPattern("Starbucks")).toBe(0);
    });

    it("returns 0 for null input", () => {
      expect(matchProviderPattern(null)).toBe(0);
    });
  });

  describe("amountsMatchWithTolerance", () => {
    it("matches exact opposite amounts with high confidence", () => {
      const result = amountsMatchWithTolerance(-100, 100);
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.95);
    });

    it("matches amounts within 1 cent with high confidence", () => {
      const result = amountsMatchWithTolerance(-100.005, 100.0);
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.95);
    });

    it("matches amounts with 1% fee (Venmo instant transfer)", () => {
      const result = amountsMatchWithTolerance(-100, 99); // 1% fee
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it("matches amounts with small fee within tolerance", () => {
      const result = amountsMatchWithTolerance(-100, 99.5); // 0.5% fee
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it("does not match amounts beyond tolerance", () => {
      const result = amountsMatchWithTolerance(-100, 95); // 5% difference
      expect(result.matches).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("does not match same-sign amounts", () => {
      const result = amountsMatchWithTolerance(-100, -100);
      expect(result.matches).toBe(false);
    });

    it("handles custom tolerance config", () => {
      const config = {
        maxDaysDiff: 3,
        amountTolerancePercent: 2, // 2% tolerance
        amountToleranceCents: 1,
      };

      const result = amountsMatchWithTolerance(-100, 98, config); // 2% fee
      expect(result.matches).toBe(true);
    });
  });

  describe("detectInternalTransfer", () => {
    it("detects exact matching opposite transactions", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-checking",
        amount: -500,
        date: "2025-01-15",
      });

      const inflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-savings",
        amount: 500,
        date: "2025-01-15",
      });

      const result = detectInternalTransfer(outflow, [outflow, inflow]);

      expect(result.isTransfer).toBe(true);
      expect(result.matchingTransaction?.id).toBe("tx-2");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("detects transfers within 3 day window", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-checking",
        amount: -1000,
        date: "2025-01-10",
      });

      const inflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-savings",
        amount: 1000,
        date: "2025-01-12", // 2 days later
      });

      const result = detectInternalTransfer(outflow, [outflow, inflow]);

      expect(result.isTransfer).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("gives higher confidence to same-day transfers", () => {
      const sameDayOutflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-1",
        amount: -100,
        date: "2025-01-15",
      });

      const sameDayInflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-2",
        amount: 100,
        date: "2025-01-15",
      });

      const resultSameDay = detectInternalTransfer(sameDayOutflow, [
        sameDayOutflow,
        sameDayInflow,
      ]);

      const differentDayOutflow = createMockTransaction({
        id: "tx-3",
        account_id: "account-1",
        amount: -100,
        date: "2025-01-10",
      });

      const differentDayInflow = createMockTransaction({
        id: "tx-4",
        account_id: "account-2",
        amount: 100,
        date: "2025-01-12",
      });

      const resultDifferentDay = detectInternalTransfer(differentDayOutflow, [
        differentDayOutflow,
        differentDayInflow,
      ]);

      expect(resultSameDay.confidence).toBeGreaterThan(
        resultDifferentDay.confidence
      );
    });

    it("does not match transactions more than 3 days apart", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-checking",
        amount: -500,
        date: "2025-01-10",
      });

      const inflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-savings",
        amount: 500,
        date: "2025-01-20", // 10 days later
      });

      const result = detectInternalTransfer(outflow, [outflow, inflow]);

      expect(result.isTransfer).toBe(false);
    });

    it("does not match transactions in the same account", () => {
      const tx1 = createMockTransaction({
        id: "tx-1",
        account_id: "account-checking",
        amount: -500,
        date: "2025-01-15",
      });

      const tx2 = createMockTransaction({
        id: "tx-2",
        account_id: "account-checking", // Same account
        amount: 500,
        date: "2025-01-15",
      });

      const result = detectInternalTransfer(tx1, [tx1, tx2]);

      expect(result.isTransfer).toBe(false);
    });

    it("detects transfers by provider pattern", () => {
      const tx = createMockTransaction({
        description_raw: "Zelle to Self - Savings Transfer",
      });

      const result = detectInternalTransfer(tx, [tx]);

      expect(result.isTransfer).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it("detects transfers by keyword in description", () => {
      const tx = createMockTransaction({
        description_raw: "ACH Transfer from Savings",
      });

      const result = detectInternalTransfer(tx, [tx]);

      expect(result.isTransfer).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.matchingTransaction).toBeUndefined();
    });

    it("handles amounts with fees (Venmo instant transfer)", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-1",
        amount: -100,
        date: "2025-01-15",
        description_raw: "Venmo Instant Transfer",
      });

      const inflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-2",
        amount: 99.5, // 0.5% fee
        date: "2025-01-15",
        description_raw: "Venmo Deposit",
      });

      const result = detectInternalTransfer(outflow, [outflow, inflow]);

      expect(result.isTransfer).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("finds best match when multiple candidates exist", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-1",
        amount: -100,
        date: "2025-01-15",
      });

      const sameDayMatch = createMockTransaction({
        id: "tx-2",
        account_id: "account-2",
        amount: 100,
        date: "2025-01-15", // Same day - higher confidence
      });

      const laterMatch = createMockTransaction({
        id: "tx-3",
        account_id: "account-3",
        amount: 100,
        date: "2025-01-17", // 2 days later - lower confidence
      });

      const result = detectInternalTransfer(outflow, [
        outflow,
        sameDayMatch,
        laterMatch,
      ]);

      expect(result.matchingTransaction?.id).toBe("tx-2"); // Should pick same-day match
    });

    it("combines multiple signals for higher confidence", () => {
      const outflow = createMockTransaction({
        id: "tx-1",
        account_id: "account-1",
        amount: -100,
        date: "2025-01-15",
        description_raw: "Chase Transfer to Savings",
      });

      const inflow = createMockTransaction({
        id: "tx-2",
        account_id: "account-2",
        amount: 100,
        date: "2025-01-15",
        description_raw: "Transfer from Checking",
      });

      const result = detectInternalTransfer(outflow, [outflow, inflow]);

      expect(result.isTransfer).toBe(true);
      // Should have high confidence from: exact amount + same day + pattern + keywords
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("classifyP2PTransaction", () => {
    it("classifies Venmo outflow as expense", () => {
      const tx = createMockTransaction({
        counterparty_name: "Venmo",
        amount: -50,
      });

      expect(classifyP2PTransaction(tx)).toBe("expense");
    });

    it("classifies Venmo inflow as income", () => {
      const tx = createMockTransaction({
        counterparty_name: "Venmo",
        amount: 50,
      });

      expect(classifyP2PTransaction(tx)).toBe("income");
    });

    it("classifies already-marked transfer as transfer", () => {
      const tx = createMockTransaction({
        counterparty_name: "Venmo",
        amount: -50,
        is_transfer: true,
      });

      expect(classifyP2PTransaction(tx)).toBe("transfer");
    });

    it("returns unknown for non-P2P transactions", () => {
      const tx = createMockTransaction({
        counterparty_name: "Amazon",
        amount: -50,
      });

      expect(classifyP2PTransaction(tx)).toBe("unknown");
    });

    it("detects P2P from description_raw if counterparty_name is empty", () => {
      const tx = createMockTransaction({
        counterparty_name: null,
        description_raw: "Zelle payment to John",
        amount: -100,
      });

      expect(classifyP2PTransaction(tx)).toBe("expense");
    });
  });

  describe("getSuggestedTransferPairs", () => {
    it("returns matching pairs of transfers", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          account_id: "checking",
          amount: -1000,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          account_id: "savings",
          amount: 1000,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-3",
          account_id: "checking",
          amount: -50, // Unrelated expense
          date: "2025-01-10",
        }),
      ];

      const pairs = getSuggestedTransferPairs(transactions);

      expect(pairs).toHaveLength(1);
      expect(pairs[0].outflow.id).toBe("tx-1");
      expect(pairs[0].inflow.id).toBe("tx-2");
      expect(pairs[0].confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("does not duplicate transactions across pairs", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          account_id: "checking",
          amount: -500,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          account_id: "savings",
          amount: 500,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-3",
          account_id: "investment",
          amount: 500, // Another matching amount
          date: "2025-01-10",
        }),
      ];

      const pairs = getSuggestedTransferPairs(transactions);

      // Should only match one pair, not create duplicate
      expect(pairs).toHaveLength(1);
    });

    it("filters by minimum confidence threshold", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          account_id: "account-1",
          amount: -100,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          account_id: "account-2",
          amount: 99, // Small fee, lower confidence
          date: "2025-01-13", // 3 days later
        }),
      ];

      // With very high confidence threshold - won't match due to fee
      const highConfPairs = getSuggestedTransferPairs(transactions, DEFAULT_CONFIG, 0.95);
      expect(highConfPairs).toHaveLength(0);

      // With lower confidence threshold - will match
      const lowConfPairs = getSuggestedTransferPairs(transactions, DEFAULT_CONFIG, 0.7);
      expect(lowConfPairs).toHaveLength(1);
    });

    it("returns empty array when no matches found", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          amount: -100,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          amount: -50,
          date: "2025-01-10",
        }),
      ];

      const pairs = getSuggestedTransferPairs(transactions);

      expect(pairs).toHaveLength(0);
    });

    it("handles multiple transfer pairs", () => {
      const transactions = [
        // First pair
        createMockTransaction({
          id: "tx-1",
          account_id: "checking",
          amount: -500,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          account_id: "savings",
          amount: 500,
          date: "2025-01-10",
        }),
        // Second pair
        createMockTransaction({
          id: "tx-3",
          account_id: "checking",
          amount: -1000,
          date: "2025-01-15",
        }),
        createMockTransaction({
          id: "tx-4",
          account_id: "investment",
          amount: 1000,
          date: "2025-01-15",
        }),
      ];

      const pairs = getSuggestedTransferPairs(transactions);

      expect(pairs).toHaveLength(2);
    });
  });

  describe("autoDetectTransfers", () => {
    it("returns transfer pairs with IDs and confidence", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-outflow",
          account_id: "checking",
          amount: -2000,
          date: "2025-01-15",
        }),
        createMockTransaction({
          id: "tx-inflow",
          account_id: "savings",
          amount: 2000,
          date: "2025-01-15",
        }),
      ];

      const result = autoDetectTransfers(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].outflowId).toBe("tx-outflow");
      expect(result[0].inflowId).toBe("tx-inflow");
      expect(result[0].confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("returns empty array when no transfers detected", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          amount: -100,
        }),
      ];

      const result = autoDetectTransfers(transactions);

      expect(result).toHaveLength(0);
    });

    it("respects minimum confidence threshold", () => {
      const transactions = [
        createMockTransaction({
          id: "tx-1",
          account_id: "account-1",
          amount: -100,
          date: "2025-01-10",
        }),
        createMockTransaction({
          id: "tx-2",
          account_id: "account-2",
          amount: 99, // Small fee, lower confidence
          date: "2025-01-13", // 3 days apart
        }),
      ];

      // Should not detect with very high threshold
      const highThreshold = autoDetectTransfers(transactions, DEFAULT_CONFIG, 0.95);
      expect(highThreshold).toHaveLength(0);

      // Should detect with lower threshold
      const lowThreshold = autoDetectTransfers(transactions, DEFAULT_CONFIG, 0.7);
      expect(lowThreshold).toHaveLength(1);
    });
  });
});
