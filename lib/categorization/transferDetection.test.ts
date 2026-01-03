import { describe, it, expect } from 'vitest'
import {
  isKnownP2PService,
  hasTransferKeywords,
  detectInternalTransfer,
  classifyP2PTransaction,
  getSuggestedTransferPairs,
  autoDetectTransfers,
} from './transferDetection'
import type { Transaction } from '@/types/database'

// Helper to create mock transactions
function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    provider: 'plaid',
    provider_transaction_id: 'test-123',
    account_id: 'account-1',
    provider_account_id: 'prov-account-1',
    date: '2025-01-15',
    amount: -100,
    description_raw: 'Test transaction',
    description_clean: null,
    life_category_id: null,
    cashflow_group: null,
    flow_type: null,
    category_ai: null,
    category_ai_conf: null,
    category_locked: false,
    status: 'posted',
    provider_type: null,
    processing_status: null,
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    category_source: null,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('isKnownP2PService', () => {
  it('returns true for Venmo', () => {
    expect(isKnownP2PService('Venmo')).toBe(true)
    expect(isKnownP2PService('VENMO PAYMENT')).toBe(true)
    expect(isKnownP2PService('Payment via Venmo')).toBe(true)
  })

  it('returns true for Zelle', () => {
    expect(isKnownP2PService('Zelle Transfer')).toBe(true)
    expect(isKnownP2PService('ZELLE')).toBe(true)
  })

  it('returns true for PayPal', () => {
    expect(isKnownP2PService('PayPal')).toBe(true)
    expect(isKnownP2PService('PAYPAL TRANSFER')).toBe(true)
  })

  it('returns true for Cash App', () => {
    expect(isKnownP2PService('Cash App')).toBe(true)
    expect(isKnownP2PService('CASHAPP')).toBe(true)
    expect(isKnownP2PService('Square Cash')).toBe(true)
  })

  it('returns true for Apple Cash and Google Pay', () => {
    expect(isKnownP2PService('Apple Cash')).toBe(true)
    expect(isKnownP2PService('Google Pay Transfer')).toBe(true)
  })

  it('returns false for null input', () => {
    expect(isKnownP2PService(null)).toBe(false)
  })

  it('returns false for non-P2P merchants', () => {
    expect(isKnownP2PService('Amazon')).toBe(false)
    expect(isKnownP2PService('Walmart')).toBe(false)
    expect(isKnownP2PService('Starbucks')).toBe(false)
  })
})

describe('hasTransferKeywords', () => {
  it('returns true for transfer keywords', () => {
    expect(hasTransferKeywords('ACH Transfer')).toBe(true)
    expect(hasTransferKeywords('Wire Transfer')).toBe(true)
    expect(hasTransferKeywords('Internal XFER')).toBe(true)
    expect(hasTransferKeywords('From Savings')).toBe(true)
    expect(hasTransferKeywords('To Checking Account')).toBe(true)
    expect(hasTransferKeywords('Sweep to savings')).toBe(true)
  })

  it('returns false for null input', () => {
    expect(hasTransferKeywords(null)).toBe(false)
  })

  it('returns false for regular transactions', () => {
    expect(hasTransferKeywords('Amazon Purchase')).toBe(false)
    expect(hasTransferKeywords('Starbucks Coffee')).toBe(false)
    expect(hasTransferKeywords('Payroll Deposit')).toBe(false)
  })
})

describe('detectInternalTransfer', () => {
  it('detects matching opposite transactions between accounts', () => {
    const outflow = createMockTransaction({
      id: 'tx-1',
      account_id: 'account-checking',
      amount: -500,
      date: '2025-01-15',
    })
    
    const inflow = createMockTransaction({
      id: 'tx-2',
      account_id: 'account-savings',
      amount: 500,
      date: '2025-01-15',
    })

    const result = detectInternalTransfer(outflow, [outflow, inflow])
    
    expect(result.isTransfer).toBe(true)
    expect(result.matchingTransaction?.id).toBe('tx-2')
  })

  it('detects transfers within 3 day window', () => {
    const outflow = createMockTransaction({
      id: 'tx-1',
      account_id: 'account-checking',
      amount: -1000,
      date: '2025-01-10',
    })
    
    const inflow = createMockTransaction({
      id: 'tx-2',
      account_id: 'account-savings',
      amount: 1000,
      date: '2025-01-12', // 2 days later
    })

    const result = detectInternalTransfer(outflow, [outflow, inflow])
    
    expect(result.isTransfer).toBe(true)
  })

  it('does not match transactions more than 3 days apart', () => {
    const outflow = createMockTransaction({
      id: 'tx-1',
      account_id: 'account-checking',
      amount: -500,
      date: '2025-01-10',
    })
    
    const inflow = createMockTransaction({
      id: 'tx-2',
      account_id: 'account-savings',
      amount: 500,
      date: '2025-01-20', // 10 days later
    })

    const result = detectInternalTransfer(outflow, [outflow, inflow])
    
    expect(result.isTransfer).toBe(false)
  })

  it('does not match transactions in the same account', () => {
    const tx1 = createMockTransaction({
      id: 'tx-1',
      account_id: 'account-checking',
      amount: -500,
      date: '2025-01-15',
    })
    
    const tx2 = createMockTransaction({
      id: 'tx-2',
      account_id: 'account-checking', // Same account
      amount: 500,
      date: '2025-01-15',
    })

    const result = detectInternalTransfer(tx1, [tx1, tx2])
    
    expect(result.isTransfer).toBe(false)
  })

  it('detects transfers by keyword in description', () => {
    const tx = createMockTransaction({
      description_raw: 'ACH Transfer from Savings',
    })

    const result = detectInternalTransfer(tx, [tx])
    
    expect(result.isTransfer).toBe(true)
    expect(result.matchingTransaction).toBeUndefined()
  })

  it('handles amounts with small rounding differences', () => {
    const outflow = createMockTransaction({
      id: 'tx-1',
      account_id: 'account-1',
      amount: -100.005, // Slight rounding
      date: '2025-01-15',
    })
    
    const inflow = createMockTransaction({
      id: 'tx-2',
      account_id: 'account-2',
      amount: 100.00,
      date: '2025-01-15',
    })

    const result = detectInternalTransfer(outflow, [outflow, inflow])
    
    expect(result.isTransfer).toBe(true)
  })
})

describe('classifyP2PTransaction', () => {
  it('classifies Venmo outflow as expense', () => {
    const tx = createMockTransaction({
      counterparty_name: 'Venmo',
      amount: -50,
    })
    
    expect(classifyP2PTransaction(tx)).toBe('expense')
  })

  it('classifies Venmo inflow as income', () => {
    const tx = createMockTransaction({
      counterparty_name: 'Venmo',
      amount: 50,
    })
    
    expect(classifyP2PTransaction(tx)).toBe('income')
  })

  it('classifies already-marked transfer as transfer', () => {
    const tx = createMockTransaction({
      counterparty_name: 'Venmo',
      amount: -50,
      is_transfer: true,
    })
    
    expect(classifyP2PTransaction(tx)).toBe('transfer')
  })

  it('returns unknown for non-P2P transactions', () => {
    const tx = createMockTransaction({
      counterparty_name: 'Amazon',
      amount: -50,
    })
    
    expect(classifyP2PTransaction(tx)).toBe('unknown')
  })

  it('detects P2P from description_raw if counterparty_name is empty', () => {
    const tx = createMockTransaction({
      counterparty_name: null,
      description_raw: 'Zelle payment to John',
      amount: -100,
    })
    
    expect(classifyP2PTransaction(tx)).toBe('expense')
  })
})

describe('getSuggestedTransferPairs', () => {
  it('returns matching pairs of transfers', () => {
    const transactions = [
      createMockTransaction({
        id: 'tx-1',
        account_id: 'checking',
        amount: -1000,
        date: '2025-01-10',
      }),
      createMockTransaction({
        id: 'tx-2',
        account_id: 'savings',
        amount: 1000,
        date: '2025-01-10',
      }),
      createMockTransaction({
        id: 'tx-3',
        account_id: 'checking',
        amount: -50, // Unrelated expense
        date: '2025-01-10',
      }),
    ]

    const pairs = getSuggestedTransferPairs(transactions)
    
    expect(pairs).toHaveLength(1)
    expect(pairs[0].outflow.id).toBe('tx-1')
    expect(pairs[0].inflow.id).toBe('tx-2')
    expect(pairs[0].confidence).toBe(0.9)
  })

  it('does not duplicate transactions across pairs', () => {
    const transactions = [
      createMockTransaction({
        id: 'tx-1',
        account_id: 'checking',
        amount: -500,
        date: '2025-01-10',
      }),
      createMockTransaction({
        id: 'tx-2',
        account_id: 'savings',
        amount: 500,
        date: '2025-01-10',
      }),
      createMockTransaction({
        id: 'tx-3',
        account_id: 'investment',
        amount: 500, // Another matching amount
        date: '2025-01-10',
      }),
    ]

    const pairs = getSuggestedTransferPairs(transactions)
    
    // Should only match one pair, not create duplicate
    expect(pairs).toHaveLength(1)
  })

  it('returns empty array when no matches found', () => {
    const transactions = [
      createMockTransaction({
        id: 'tx-1',
        amount: -100,
        date: '2025-01-10',
      }),
      createMockTransaction({
        id: 'tx-2',
        amount: -50,
        date: '2025-01-10',
      }),
    ]

    const pairs = getSuggestedTransferPairs(transactions)
    
    expect(pairs).toHaveLength(0)
  })
})

describe('autoDetectTransfers', () => {
  it('returns IDs of detected transfer pairs', async () => {
    const transactions = [
      createMockTransaction({
        id: 'tx-outflow',
        account_id: 'checking',
        amount: -2000,
        date: '2025-01-15',
      }),
      createMockTransaction({
        id: 'tx-inflow',
        account_id: 'savings',
        amount: 2000,
        date: '2025-01-15',
      }),
    ]

    const transferIds = await autoDetectTransfers(transactions)
    
    expect(transferIds).toContain('tx-outflow')
    expect(transferIds).toContain('tx-inflow')
    expect(transferIds).toHaveLength(2)
  })

  it('returns empty array when no transfers detected', async () => {
    const transactions = [
      createMockTransaction({
        id: 'tx-1',
        amount: -100,
      }),
    ]

    const transferIds = await autoDetectTransfers(transactions)
    
    expect(transferIds).toHaveLength(0)
  })
})
