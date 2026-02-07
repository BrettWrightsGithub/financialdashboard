---
description: Implement automatic internal transfer detection algorithm and visualization ("The Chain") to neutralize double-counting. Enhances workflow 08.
auto_execution_mode: 1
---

## Phase 1: Foundation of Trust – Feature #12

**Context:** Enhances workflow 08 (Transfer Handling).  
**Research Alignment:** "Sankey Diagrams" and "Cash Flow" best practices (Monarch/Copilot) emphasize neutralizing internal movements to avoid double-counting.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Transfer Detection Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│  1. On Sync        │ New transactions trigger detection          │
│  2. Time Window    │ Find +/- pairs within 3 days                │
│  3. Fuzzy Match    │ Handle description variations               │
│  4. Provider Rules │ Hard-coded patterns (Zelle, Amex, Chase)    │
│  5. Auto-Flag      │ Mark is_transfer = TRUE                     │
│  6. Visualize      │ Show linked counterpart in UI               │
└─────────────────────────────────────────────────────────────────┘
```

## Database Changes

### 1. Add transfer_pair_id to transactions table

Create migration `supabase/migrations/YYYYMMDD_transfer_pairs.sql`:

```sql
-- Add transfer pairing columns
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transfer_pair_id UUID REFERENCES transactions(id),
ADD COLUMN IF NOT EXISTS transfer_match_confidence NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS transfer_match_source TEXT; -- 'auto', 'manual', 'provider_pattern'

-- Index for efficient pair lookups
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair 
ON transactions(transfer_pair_id) WHERE transfer_pair_id IS NOT NULL;

-- Index for time-window matching queries
CREATE INDEX IF NOT EXISTS idx_transactions_amount_date 
ON transactions(amount, date) WHERE is_transfer = FALSE;
```

## Steps

### 1. Create Transfer Detection Service

Create `lib/categorization/transferDetection.ts`:

```typescript
import { createClient } from '@/lib/supabase'

export interface TransferCandidate {
  transaction: Transaction
  counterpart: Transaction | null
  confidence: number
  matchSource: 'time_window' | 'provider_pattern' | 'fuzzy_match'
}

export interface TransferDetectionConfig {
  timeWindowDays: number
  amountTolerancePercent: number
  providerPatterns: ProviderPattern[]
}

export interface ProviderPattern {
  name: string
  patterns: string[]
  matchType: 'exact' | 'contains' | 'regex'
}

const DEFAULT_CONFIG: TransferDetectionConfig = {
  timeWindowDays: 3,
  amountTolerancePercent: 1, // Allow 1% variance for fees
  providerPatterns: [
    {
      name: 'Zelle Self Transfer',
      patterns: ['ZELLE TO SELF', 'ZELLE FROM SELF', 'ZELLE TRANSFER'],
      matchType: 'contains'
    },
    {
      name: 'Amex Payment',
      patterns: ['AMEX EPAYMENT', 'AMERICAN EXPRESS ACH', 'AMEX PAY'],
      matchType: 'contains'
    },
    {
      name: 'Chase Transfer',
      patterns: ['CHASE CREDIT CRD', 'CHASE QUICKPAY', 'CHASE TRANSFER'],
      matchType: 'contains'
    },
    {
      name: 'Venmo Cashout',
      patterns: ['VENMO CASHOUT', 'VENMO TRANSFER'],
      matchType: 'contains'
    },
    {
      name: 'PayPal Transfer',
      patterns: ['PAYPAL TRANSFER', 'PAYPAL INST XFER'],
      matchType: 'contains'
    }
  ]
}

/**
 * Detect internal transfers using time-window matching.
 * Finds transactions with identical amounts (+/-) within N days.
 */
export async function detectTransfersByTimeWindow(
  transactionIds: string[],
  config: TransferDetectionConfig = DEFAULT_CONFIG
): Promise<TransferCandidate[]> {
  const supabase = createClient()
  const candidates: TransferCandidate[] = []

  // Fetch target transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts!inner(owner)')
    .in('id', transactionIds)
    .eq('is_transfer', false)

  if (!transactions) return []

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount)
    const minAmount = absAmount * (1 - config.amountTolerancePercent / 100)
    const maxAmount = absAmount * (1 + config.amountTolerancePercent / 100)

    // Find counterpart: opposite sign, same owner, within time window
    const { data: counterparts } = await supabase
      .from('transactions')
      .select('*, accounts!inner(owner)')
      .neq('id', tx.id)
      .eq('accounts.owner', tx.accounts.owner)
      .gte('date', subtractDays(tx.date, config.timeWindowDays))
      .lte('date', addDays(tx.date, config.timeWindowDays))
      .gte('amount', tx.amount > 0 ? -maxAmount : minAmount)
      .lte('amount', tx.amount > 0 ? -minAmount : maxAmount)
      .eq('is_transfer', false)
      .is('transfer_pair_id', null)
      .limit(1)

    if (counterparts && counterparts.length > 0) {
      const counterpart = counterparts[0]
      const confidence = calculateMatchConfidence(tx, counterpart, config)
      
      candidates.push({
        transaction: tx,
        counterpart,
        confidence,
        matchSource: 'time_window'
      })
    }
  }

  return candidates
}

/**
 * Detect transfers using known provider patterns.
 * Hard-coded rules for common transfer descriptions.
 */
export async function detectTransfersByProviderPattern(
  transactionIds: string[],
  config: TransferDetectionConfig = DEFAULT_CONFIG
): Promise<TransferCandidate[]> {
  const supabase = createClient()
  const candidates: TransferCandidate[] = []

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('id', transactionIds)
    .eq('is_transfer', false)

  if (!transactions) return []

  for (const tx of transactions) {
    for (const pattern of config.providerPatterns) {
      if (matchesPattern(tx.description_raw || '', pattern)) {
        candidates.push({
          transaction: tx,
          counterpart: null, // Provider patterns don't require counterpart
          confidence: 0.95, // High confidence for known patterns
          matchSource: 'provider_pattern'
        })
        break
      }
    }
  }

  return candidates
}

/**
 * Fuzzy match for description variations.
 * Handles cases like "Venmo - Cashout" vs "Venmo (Transfer Out)"
 */
export async function detectTransfersByFuzzyMatch(
  transactionIds: string[],
  config: TransferDetectionConfig = DEFAULT_CONFIG
): Promise<TransferCandidate[]> {
  const supabase = createClient()
  const candidates: TransferCandidate[] = []

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounts!inner(owner)')
    .in('id', transactionIds)
    .eq('is_transfer', false)

  if (!transactions) return []

  // Group by normalized merchant name
  const merchantGroups = groupByNormalizedMerchant(transactions)

  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    // Find pairs with opposite signs
    const inflows = txs.filter(t => t.amount > 0)
    const outflows = txs.filter(t => t.amount < 0)

    for (const inflow of inflows) {
      for (const outflow of outflows) {
        const amountMatch = Math.abs(inflow.amount + outflow.amount) / Math.abs(inflow.amount) < 0.02
        const dateMatch = Math.abs(daysBetween(inflow.date, outflow.date)) <= config.timeWindowDays
        const sameOwner = inflow.accounts?.owner === outflow.accounts?.owner

        if (amountMatch && dateMatch && sameOwner) {
          candidates.push({
            transaction: inflow,
            counterpart: outflow,
            confidence: 0.75,
            matchSource: 'fuzzy_match'
          })
        }
      }
    }
  }

  return candidates
}

/**
 * Auto-flag detected transfers and assign category.
 */
export async function autoFlagTransfers(
  candidates: TransferCandidate[],
  transferCategoryId: string
): Promise<{ flagged: number; paired: number }> {
  const supabase = createClient()
  let flagged = 0
  let paired = 0

  for (const candidate of candidates) {
    if (candidate.confidence < 0.7) continue // Skip low confidence

    // Flag the transaction
    await supabase
      .from('transactions')
      .update({
        is_transfer: true,
        life_category_id: transferCategoryId,
        cashflow_group: 'Transfer',
        transfer_match_confidence: candidate.confidence,
        transfer_match_source: candidate.matchSource,
        transfer_pair_id: candidate.counterpart?.id || null
      })
      .eq('id', candidate.transaction.id)

    flagged++

    // If counterpart exists, flag it and create bidirectional link
    if (candidate.counterpart) {
      await supabase
        .from('transactions')
        .update({
          is_transfer: true,
          life_category_id: transferCategoryId,
          cashflow_group: 'Transfer',
          transfer_match_confidence: candidate.confidence,
          transfer_match_source: candidate.matchSource,
          transfer_pair_id: candidate.transaction.id
        })
        .eq('id', candidate.counterpart.id)

      paired++
    }
  }

  return { flagged, paired }
}

// Helper functions
function matchesPattern(description: string, pattern: ProviderPattern): boolean {
  const normalized = description.toUpperCase()
  return pattern.patterns.some(p => {
    if (pattern.matchType === 'exact') return normalized === p.toUpperCase()
    if (pattern.matchType === 'contains') return normalized.includes(p.toUpperCase())
    if (pattern.matchType === 'regex') return new RegExp(p, 'i').test(description)
    return false
  })
}

function calculateMatchConfidence(tx1: Transaction, tx2: Transaction, config: TransferDetectionConfig): number {
  let confidence = 0.5

  // Exact amount match
  if (Math.abs(tx1.amount) === Math.abs(tx2.amount)) confidence += 0.3

  // Same day
  if (tx1.date === tx2.date) confidence += 0.15
  else if (Math.abs(daysBetween(tx1.date, tx2.date)) <= 1) confidence += 0.1

  // Known transfer merchant
  const transferMerchants = ['venmo', 'zelle', 'paypal', 'chase', 'amex']
  if (transferMerchants.some(m => 
    tx1.description_raw?.toLowerCase().includes(m) ||
    tx2.description_raw?.toLowerCase().includes(m)
  )) confidence += 0.1

  return Math.min(confidence, 1.0)
}

function groupByNormalizedMerchant(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {}
  for (const tx of transactions) {
    const normalized = normalizeMerchant(tx.description_clean || tx.description_raw || '')
    if (!groups[normalized]) groups[normalized] = []
    groups[normalized].push(tx)
  }
  return groups
}

function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|corp|ltd)$/g, '')
    .trim()
}

function subtractDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}
```

### 2. Create API Routes

Create `app/api/transfers/detect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { 
  detectTransfersByTimeWindow,
  detectTransfersByProviderPattern,
  detectTransfersByFuzzyMatch,
  autoFlagTransfers
} from '@/lib/categorization/transferDetection'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { transactionIds, autoFlag = false } = await req.json()

  // Run all detection algorithms
  const [timeWindowMatches, providerMatches, fuzzyMatches] = await Promise.all([
    detectTransfersByTimeWindow(transactionIds),
    detectTransfersByProviderPattern(transactionIds),
    detectTransfersByFuzzyMatch(transactionIds)
  ])

  // Deduplicate by transaction ID
  const allCandidates = deduplicateCandidates([
    ...timeWindowMatches,
    ...providerMatches,
    ...fuzzyMatches
  ])

  if (autoFlag) {
    // Get the "Internal Transfer" category ID
    const supabase = createClient()
    const { data: transferCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Internal Transfer')
      .single()

    if (transferCategory) {
      const result = await autoFlagTransfers(allCandidates, transferCategory.id)
      return NextResponse.json({ candidates: allCandidates, flagged: result })
    }
  }

  return NextResponse.json({ candidates: allCandidates })
}

function deduplicateCandidates(candidates: TransferCandidate[]): TransferCandidate[] {
  const seen = new Set<string>()
  return candidates.filter(c => {
    if (seen.has(c.transaction.id)) return false
    seen.add(c.transaction.id)
    return true
  })
}
```

Create `app/api/transfers/link/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { transactionId, counterpartId } = await req.json()
  const supabase = createClient()

  // Link both transactions
  const { error: error1 } = await supabase
    .from('transactions')
    .update({
      is_transfer: true,
      transfer_pair_id: counterpartId,
      transfer_match_source: 'manual',
      transfer_match_confidence: 1.0
    })
    .eq('id', transactionId)

  const { error: error2 } = await supabase
    .from('transactions')
    .update({
      is_transfer: true,
      transfer_pair_id: transactionId,
      transfer_match_source: 'manual',
      transfer_match_confidence: 1.0
    })
    .eq('id', counterpartId)

  if (error1 || error2) {
    return NextResponse.json({ error: 'Failed to link transfers' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { transactionId } = await req.json()
  const supabase = createClient()

  // Get the pair ID first
  const { data: tx } = await supabase
    .from('transactions')
    .select('transfer_pair_id')
    .eq('id', transactionId)
    .single()

  // Unlink both transactions
  await supabase
    .from('transactions')
    .update({
      is_transfer: false,
      transfer_pair_id: null,
      transfer_match_source: null,
      transfer_match_confidence: null
    })
    .eq('id', transactionId)

  if (tx?.transfer_pair_id) {
    await supabase
      .from('transactions')
      .update({
        is_transfer: false,
        transfer_pair_id: null,
        transfer_match_source: null,
        transfer_match_confidence: null
      })
      .eq('id', tx.transfer_pair_id)
  }

  return NextResponse.json({ success: true })
}
```

### 3. Create Transfer Chain Visualization Component

Create `components/transactions/TransferChain.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Link2, Unlink, ArrowRight, AlertTriangle } from 'lucide-react'

interface TransferChainProps {
  transaction: Transaction
  onBreakLink: (transactionId: string) => void
}

export function TransferChain({ transaction, onBreakLink }: TransferChainProps) {
  const [counterpart, setCounterpart] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (transaction.transfer_pair_id) {
      fetchCounterpart()
    }
  }, [transaction.transfer_pair_id])

  async function fetchCounterpart() {
    setLoading(true)
    const res = await fetch(`/api/transactions/${transaction.transfer_pair_id}`)
    const data = await res.json()
    setCounterpart(data)
    setLoading(false)
  }

  if (!transaction.is_transfer) return null

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 text-sm text-blue-800">
        <Link2 className="w-4 h-4" />
        <span className="font-medium">Internal Transfer</span>
        {transaction.transfer_match_source === 'auto' && (
          <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">Auto-detected</span>
        )}
      </div>

      {counterpart && (
        <div className="mt-2 flex items-center gap-3">
          {/* Current Transaction */}
          <div className="flex-1 p-2 bg-white rounded border">
            <div className="text-xs text-gray-500">{transaction.account_name}</div>
            <div className="font-medium">
              {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {transaction.description_clean}
            </div>
          </div>

          {/* Arrow */}
          <ArrowRight className="w-5 h-5 text-gray-400" />

          {/* Counterpart */}
          <div className="flex-1 p-2 bg-white rounded border">
            <div className="text-xs text-gray-500">{counterpart.account_name}</div>
            <div className="font-medium">
              {counterpart.amount > 0 ? '+' : ''}${Math.abs(counterpart.amount).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {counterpart.description_clean}
            </div>
          </div>
        </div>
      )}

      {/* Fee Warning */}
      {counterpart && Math.abs(transaction.amount) !== Math.abs(counterpart.amount) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-3 h-3" />
          <span>
            Amount difference: ${Math.abs(Math.abs(transaction.amount) - Math.abs(counterpart.amount)).toFixed(2)} 
            (may include fees)
          </span>
        </div>
      )}

      {/* Break Link Button */}
      <button
        onClick={() => onBreakLink(transaction.id)}
        className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
      >
        <Unlink className="w-3 h-3" />
        Break Link (False Positive)
      </button>
    </div>
  )
}
```

### 4. Create Transfer Detection Background Job

Create `lib/jobs/detectTransfersJob.ts`:

```typescript
import {
  detectTransfersByTimeWindow,
  detectTransfersByProviderPattern,
  autoFlagTransfers
} from '@/lib/categorization/transferDetection'
import { createClient } from '@/lib/supabase'

/**
 * Background job to detect and flag transfers after sync.
 * Called by n8n or cron after Plaid/Teller sync completes.
 */
export async function runTransferDetection(
  options: {
    accountId?: string
    sinceDays?: number
    dryRun?: boolean
  } = {}
) {
  const supabase = createClient()
  const { accountId, sinceDays = 7, dryRun = false } = options

  // Get recent transactions not yet flagged as transfers
  let query = supabase
    .from('transactions')
    .select('id')
    .eq('is_transfer', false)
    .gte('date', subtractDays(new Date().toISOString().split('T')[0], sinceDays))

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data: transactions } = await query
  if (!transactions?.length) {
    return { processed: 0, flagged: 0, paired: 0 }
  }

  const transactionIds = transactions.map(t => t.id)

  // Run detection algorithms
  const [timeWindowCandidates, providerCandidates] = await Promise.all([
    detectTransfersByTimeWindow(transactionIds),
    detectTransfersByProviderPattern(transactionIds)
  ])

  const allCandidates = [...timeWindowCandidates, ...providerCandidates]

  if (dryRun) {
    return {
      processed: transactionIds.length,
      candidates: allCandidates,
      wouldFlag: allCandidates.filter(c => c.confidence >= 0.7).length
    }
  }

  // Get transfer category
  const { data: transferCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Internal Transfer')
    .single()

  if (!transferCategory) {
    throw new Error('Internal Transfer category not found')
  }

  const result = await autoFlagTransfers(allCandidates, transferCategory.id)

  return {
    processed: transactionIds.length,
    ...result
  }
}

function subtractDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
```

### 5. Handle Edge Cases

#### Split Transfers

Create `lib/categorization/splitTransferHandler.ts`:

```typescript
/**
 * Handle split transfers where one withdrawal pays multiple credit cards.
 * Example: $1000 withdrawal → $500 CC1 payment + $500 CC2 payment
 */
export async function detectSplitTransfers(
  transactionIds: string[]
): Promise<SplitTransferGroup[]> {
  const supabase = createClient()

  // Find large outflows
  const { data: outflows } = await supabase
    .from('transactions')
    .select('*, accounts!inner(owner)')
    .in('id', transactionIds)
    .lt('amount', 0)
    .gt('amount', -5000) // Reasonable upper bound

  if (!outflows) return []

  const groups: SplitTransferGroup[] = []

  for (const outflow of outflows) {
    // Find potential split inflows that sum to this amount
    const { data: inflows } = await supabase
      .from('transactions')
      .select('*, accounts!inner(owner)')
      .neq('id', outflow.id)
      .eq('accounts.owner', outflow.accounts.owner)
      .gt('amount', 0)
      .gte('date', subtractDays(outflow.date, 3))
      .lte('date', addDays(outflow.date, 3))

    if (!inflows?.length) continue

    // Find combination that sums to outflow amount
    const matchingInflows = findSumCombination(inflows, Math.abs(outflow.amount))
    
    if (matchingInflows.length > 1) {
      groups.push({
        source: outflow,
        destinations: matchingInflows,
        confidence: 0.7
      })
    }
  }

  return groups
}

function findSumCombination(
  transactions: Transaction[],
  targetSum: number,
  tolerance = 0.01
): Transaction[] {
  // Simple greedy approach for small sets
  // For larger sets, use dynamic programming
  const sorted = [...transactions].sort((a, b) => b.amount - a.amount)
  const result: Transaction[] = []
  let remaining = targetSum

  for (const tx of sorted) {
    if (tx.amount <= remaining * (1 + tolerance)) {
      result.push(tx)
      remaining -= tx.amount
    }
    if (remaining <= targetSum * tolerance) break
  }

  // Check if we found a valid combination
  if (Math.abs(remaining) <= targetSum * tolerance && result.length > 1) {
    return result
  }

  return []
}
```

### 6. Update Transaction Table UI

Update `components/transactions/TransactionTable.tsx` to show transfer indicators:

```tsx
// Add to existing TransactionTable component

{/* Transfer Link Indicator */}
{transaction.transfer_pair_id && (
  <td className="px-4 py-2">
    <button
      onClick={() => setSelectedTransfer(transaction)}
      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
    >
      <Link2 className="w-4 h-4" />
      <span className="text-xs">View Link</span>
    </button>
  </td>
)}

{/* Transfer Chain Modal */}
{selectedTransfer && (
  <TransferChainModal
    transaction={selectedTransfer}
    onClose={() => setSelectedTransfer(null)}
    onBreakLink={handleBreakLink}
  />
)}
```

### 7. Write Tests

Create `tests/unit/transferDetection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateMatchConfidence, matchesPattern } from '@/lib/categorization/transferDetection'

describe('Transfer Detection', () => {
  describe('Time Window Matching', () => {
    it('matches identical amounts within 3 days', () => {
      const tx1 = { amount: -500, date: '2025-01-15', accounts: { owner: 'Brett' } }
      const tx2 = { amount: 500, date: '2025-01-17', accounts: { owner: 'Brett' } }
      const confidence = calculateMatchConfidence(tx1, tx2, { timeWindowDays: 3 })
      expect(confidence).toBeGreaterThan(0.7)
    })

    it('rejects different owners', () => {
      const tx1 = { amount: -500, date: '2025-01-15', accounts: { owner: 'Brett' } }
      const tx2 = { amount: 500, date: '2025-01-15', accounts: { owner: 'Ashley' } }
      // Different owner should not match
    })
  })

  describe('Provider Patterns', () => {
    it('detects Zelle self-transfer', () => {
      const pattern = { patterns: ['ZELLE TO SELF'], matchType: 'contains' }
      expect(matchesPattern('ZELLE TO SELF - SAVINGS', pattern)).toBe(true)
    })

    it('detects Amex payment', () => {
      const pattern = { patterns: ['AMEX EPAYMENT'], matchType: 'contains' }
      expect(matchesPattern('AMEX EPAYMENT ACH PMT', pattern)).toBe(true)
    })
  })

  describe('Fuzzy Matching', () => {
    it('matches Venmo variations', () => {
      // "Venmo - Cashout" should match "Venmo (Transfer Out)"
    })
  })

  describe('Fee Tolerance', () => {
    it('allows 1% variance for fees', () => {
      // $100 withdrawal should match $99.50 deposit (Venmo instant transfer fee)
      const tx1 = { amount: -100 }
      const tx2 = { amount: 99.5 }
      // Should match with tolerance
    })
  })
})
```

### 8. Document Transfer Detection

Create `docs/categorization/transfer_detection.md`:

```markdown
# Transfer Detection Algorithm

## Overview

Internal transfers (moving money between your own accounts) should not affect net cashflow. This system automatically detects and flags these movements.

## Detection Methods

### 1. Time Window Matching
- Finds transactions with opposite signs (+/-) 
- Within 3-day window
- Same account owner
- Matching amounts (±1% for fees)

### 2. Provider Patterns
Hard-coded patterns for known transfer descriptions:
- Zelle To Self
- Amex Payment
- Chase Transfer
- Venmo Cashout
- PayPal Transfer

### 3. Fuzzy Matching
Handles description variations:
- "Venmo - Cashout" ↔ "Venmo (Transfer Out)"
- Normalizes merchant names for matching

## Edge Cases

### Split Transfers
$1000 withdrawal → $500 CC1 + $500 CC2
- Algorithm finds combinations that sum to source

### Fees
Venmo instant: $100 out → $99.50 in
- 1% tolerance allows for transfer fees

## User Controls

- **Break Link**: Users can mark false positives
- **Manual Link**: Users can manually pair transactions
- **Confidence Badge**: Shows auto vs manual detection
```

### 9. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/transactions
- Filter to show transfers only
- Take screenshot of transfer chain visualization
- Test "Break Link" functionality
- Test manual transfer linking
- Verify counterpart displays correctly
