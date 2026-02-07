---
description: Implement backfill with preview and undo capability after rule creation. Shows impact analysis before applying rules retroactively. Extends workflow 13.
auto_execution_mode: 1
---

## Phase 2: The "Assistant" Interface – Feature #2

**Context:** Extends workflow 13 (Retroactive Rules).  
**Trigger:** Immediately after creating a rule (via Chat or Form), the system asks if user wants to apply to existing transactions.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backfill with Review Flow                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Rule Created    │ User creates rule via Chat/Form          │
│  2. Prompt          │ "Apply to existing transactions?"        │
│  3. Impact Preview  │ Query matching txs, show count/total     │
│  4. Before/After    │ Table of top 5 examples                  │
│  5. Execute         │ fn_run_categorization_waterfall          │
│  6. Progress        │ Show progress bar for large datasets     │
│  7. Undo Ready      │ Create batch ID for revert capability    │
└─────────────────────────────────────────────────────────────────┘
```

## Steps

### 1. Create Backfill Preview API

Create `app/api/rules/[ruleId]/preview/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  const supabase = createClient()
  const { ruleId } = params
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  // Fetch the rule
  const { data: rule } = await supabase
    .from('categorization_rules')
    .select('*, categories!assign_category_id(name, cashflow_group)')
    .eq('id', ruleId)
    .single()

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  // Build match query
  let query = supabase
    .from('transactions')
    .select('id, description_clean, amount, date, life_category_id, categories!life_category_id(name)')
    .eq('category_locked', false)
    .neq('life_category_id', rule.assign_category_id) // Only transactions that would change

  // Apply merchant match
  if (rule.match_merchant_contains) {
    query = query.ilike('description_clean', `%${rule.match_merchant_contains}%`)
  }
  if (rule.match_merchant_exact) {
    query = query.eq('description_clean', rule.match_merchant_exact)
  }

  // Apply amount filters (using absolute value logic)
  if (rule.match_amount_min !== null) {
    query = query.or(`amount.gte.${rule.match_amount_min},amount.lte.${-rule.match_amount_min}`)
  }
  if (rule.match_amount_max !== null) {
    query = query.or(`amount.lte.${rule.match_amount_max},amount.gte.${-rule.match_amount_max}`)
  }

  // Apply direction filter
  if (rule.match_direction === 'inflow') {
    query = query.gt('amount', 0)
  } else if (rule.match_direction === 'outflow') {
    query = query.lt('amount', 0)
  }

  // Apply date range
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data: matchingTransactions, count } = await query
    .order('date', { ascending: false })
    .limit(100) // Limit for preview

  // Calculate totals
  const totalAmount = matchingTransactions?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0
  const totalCount = count || matchingTransactions?.length || 0

  // Get top 5 examples for before/after preview
  const examples = (matchingTransactions || []).slice(0, 5).map(tx => ({
    id: tx.id,
    description: tx.description_clean,
    amount: tx.amount,
    date: tx.date,
    currentCategory: tx.categories?.name || 'Uncategorized',
    newCategory: rule.categories?.name
  }))

  return NextResponse.json({
    rule: {
      id: rule.id,
      name: rule.name,
      targetCategory: rule.categories?.name
    },
    impact: {
      transactionCount: totalCount,
      totalAmount: totalAmount,
      examples
    }
  })
}
```

### 2. Create Backfill Execution API

Create `app/api/rules/[ruleId]/apply/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  const supabase = createClient()
  const { ruleId } = params
  const { dateFrom, dateTo, transactionIds } = await req.json()

  // Fetch the rule
  const { data: rule } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('id', ruleId)
    .single()

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  // Create batch record for undo capability
  const { data: batch, error: batchError } = await supabase
    .from('rule_application_batches')
    .insert({
      rule_id: ruleId,
      operation_type: 'rule_apply',
      date_range_start: dateFrom || null,
      date_range_end: dateTo || null,
      description: `Applied rule "${rule.name}" retroactively`
    })
    .select('id')
    .single()

  if (batchError) {
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 })
  }

  // Get matching transaction IDs if not provided
  let txIds = transactionIds
  if (!txIds || txIds.length === 0) {
    let query = supabase
      .from('transactions')
      .select('id')
      .eq('category_locked', false)
      .neq('life_category_id', rule.assign_category_id)

    if (rule.match_merchant_contains) {
      query = query.ilike('description_clean', `%${rule.match_merchant_contains}%`)
    }
    if (rule.match_merchant_exact) {
      query = query.eq('description_clean', rule.match_merchant_exact)
    }
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)

    const { data: transactions } = await query
    txIds = transactions?.map(t => t.id) || []
  }

  if (txIds.length === 0) {
    return NextResponse.json({
      batchId: batch.id,
      applied: 0,
      message: 'No matching transactions found'
    })
  }

  // Call the stored procedure
  const { data: result, error: rpcError } = await supabase.rpc(
    'fn_run_categorization_waterfall',
    {
      p_batch_id: batch.id,
      p_transaction_ids: txIds
    }
  )

  if (rpcError) {
    console.error('Waterfall RPC error:', rpcError)
    return NextResponse.json({ error: 'Failed to apply rule' }, { status: 500 })
  }

  // Update batch with transaction count
  await supabase
    .from('rule_application_batches')
    .update({ transaction_count: result?.rules_applied || 0 })
    .eq('id', batch.id)

  return NextResponse.json({
    batchId: batch.id,
    applied: result?.rules_applied || 0,
    total: txIds.length,
    message: `Successfully applied rule to ${result?.rules_applied} transactions`
  })
}
```

### 3. Create Backfill Modal Component

Create `components/rules/BackfillModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'

interface BackfillModalProps {
  ruleId: string
  ruleName: string
  isOpen: boolean
  onClose: () => void
  onComplete: (result: BackfillResult) => void
}

interface ImpactPreview {
  transactionCount: number
  totalAmount: number
  examples: {
    id: string
    description: string
    amount: number
    date: string
    currentCategory: string
    newCategory: string
  }[]
}

export function BackfillModal({ ruleId, ruleName, isOpen, onClose, onComplete }: BackfillModalProps) {
  const [step, setStep] = useState<'preview' | 'confirm' | 'executing' | 'done'>('preview')
  const [preview, setPreview] = useState<ImpactPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<BackfillResult | null>(null)
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({})

  useEffect(() => {
    if (isOpen) {
      fetchPreview()
    }
  }, [isOpen, ruleId, dateRange])

  async function fetchPreview() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateRange.from) params.set('dateFrom', dateRange.from)
    if (dateRange.to) params.set('dateTo', dateRange.to)

    const res = await fetch(`/api/rules/${ruleId}/preview?${params}`)
    const data = await res.json()
    setPreview(data.impact)
    setLoading(false)
  }

  async function handleApply() {
    setStep('executing')
    setProgress(0)

    // Simulate progress for UX (actual execution is atomic)
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90))
    }, 200)

    try {
      const res = await fetch(`/api/rules/${ruleId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: dateRange.from,
          dateTo: dateRange.to
        })
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await res.json()
      setResult(data)
      setStep('done')
      onComplete(data)
    } catch (error) {
      clearInterval(progressInterval)
      setResult({ error: 'Failed to apply rule' })
      setStep('done')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Apply Rule to Past Transactions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {step === 'preview' && (
            <>
              {/* Date Range Filter */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Date Range (Optional)</h3>
                <div className="flex gap-4">
                  <div>
                    <label className="text-xs text-gray-500">From</label>
                    <input
                      type="date"
                      value={dateRange.from || ''}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="block mt-1 px-3 py-2 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">To</label>
                    <input
                      type="date"
                      value={dateRange.to || ''}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="block mt-1 px-3 py-2 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Impact Summary */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : preview ? (
                <>
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">
                          This will affect {preview.transactionCount} transactions
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          Total amount: ${preview.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Before/After Examples */}
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Preview (Top 5 Examples)</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Category Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.examples.map((ex) => (
                        <tr key={ex.id}>
                          <td className="px-3 py-2 text-gray-600">{ex.date}</td>
                          <td className="px-3 py-2 truncate max-w-[150px]">{ex.description}</td>
                          <td className="px-3 py-2 text-right">
                            ${Math.abs(ex.amount).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                {ex.currentCategory}
                              </span>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                {ex.newCategory}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="text-gray-500">No matching transactions found.</p>
              )}
            </>
          )}

          {step === 'executing' && (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-700">Applying rule to transactions...</p>
                <div className="w-full max-w-xs mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{progress}%</p>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="py-8">
              {result.error ? (
                <div className="flex flex-col items-center text-red-600">
                  <AlertTriangle className="w-8 h-8 mb-4" />
                  <p>{result.error}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-green-600">
                  <CheckCircle className="w-8 h-8 mb-4" />
                  <p className="font-medium">{result.message}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Batch ID: {result.batchId}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    You can undo this from Admin → Rule Batches
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!preview || preview.transactionCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Apply to {preview?.transactionCount || 0} Transactions
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 4. Integrate Backfill Prompt into Chat Flow

Update `components/assistant/ChatAssistant.tsx`:

```tsx
// After rule is confirmed, add backfill prompt
async function handleConfirmRule(messageId: string, rule: GeneratedRule) {
  // ... existing save logic ...

  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    role: 'assistant',
    content: `✅ Rule "${rule.name}" saved!\n\nWould you like to apply this rule to existing transactions?`,
    backfillPrompt: {
      ruleId: savedRule.id,
      ruleName: savedRule.name
    }
  }])
}

// Handle backfill response
function handleBackfillResponse(apply: boolean, ruleId: string, ruleName: string) {
  if (apply) {
    setShowBackfillModal(true)
    setBackfillRuleId(ruleId)
    setBackfillRuleName(ruleName)
  } else {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'No problem! The rule will apply to new transactions going forward.'
    }])
  }
}

// In render:
{message.backfillPrompt && (
  <div className="mt-3 flex gap-2">
    <button
      onClick={() => handleBackfillResponse(true, message.backfillPrompt.ruleId, message.backfillPrompt.ruleName)}
      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
    >
      Yes, Apply to Past
    </button>
    <button
      onClick={() => handleBackfillResponse(false, message.backfillPrompt.ruleId, message.backfillPrompt.ruleName)}
      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
    >
      No, Just Future
    </button>
  </div>
)}

{showBackfillModal && (
  <BackfillModal
    ruleId={backfillRuleId}
    ruleName={backfillRuleName}
    isOpen={showBackfillModal}
    onClose={() => setShowBackfillModal(false)}
    onComplete={(result) => {
      setShowBackfillModal(false)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: result.error 
          ? `❌ ${result.error}`
          : `✅ Applied to ${result.applied} transactions. You can undo this from Admin → Batches.`
      }])
    }}
  />
)}
```

### 5. Add Undo Link to Success Message

Create `components/rules/UndoLink.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Undo2, Loader2 } from 'lucide-react'

interface UndoLinkProps {
  batchId: string
  transactionCount: number
  onUndo: () => void
}

export function UndoLink({ batchId, transactionCount, onUndo }: UndoLinkProps) {
  const [loading, setLoading] = useState(false)
  const [undone, setUndone] = useState(false)

  async function handleUndo() {
    if (!confirm(`This will revert ${transactionCount} transactions to their previous categories. Continue?`)) {
      return
    }

    setLoading(true)
    const res = await fetch('/api/rules/undo-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId })
    })

    setLoading(false)
    if (res.ok) {
      setUndone(true)
      onUndo()
    }
  }

  if (undone) {
    return <span className="text-sm text-gray-500">Reverted</span>
  }

  return (
    <button
      onClick={handleUndo}
      disabled={loading}
      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Undo2 className="w-3 h-3" />
      )}
      Undo
    </button>
  )
}
```

### 6. Write Tests

Create `tests/unit/backfill.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('Backfill Preview', () => {
  it('returns correct transaction count', async () => {
    // Mock rule and transactions
  })

  it('respects date range filter', async () => {
    // Test date filtering
  })

  it('excludes locked transactions', async () => {
    // category_locked = true should not appear
  })

  it('excludes transactions already in target category', async () => {
    // Already categorized correctly should not count
  })
})

describe('Backfill Execution', () => {
  it('creates batch record for undo', async () => {
    // Verify batch is created
  })

  it('updates audit log for each transaction', async () => {
    // Verify audit entries
  })

  it('returns correct applied count', async () => {
    // Verify statistics
  })
})
```

### 7. Document the Feature

Create `docs/assistant/backfill_with_review.md`:

```markdown
# Backfill with Review

## Flow

1. **Rule Created**: User creates rule via Chat or Form
2. **Prompt**: System asks "Apply to existing transactions?"
3. **Preview**: Shows impact (count, total amount, examples)
4. **Confirm**: User reviews before/after table
5. **Execute**: Applies via `fn_run_categorization_waterfall`
6. **Undo Ready**: Batch ID saved for revert capability

## Safety Features

- **Preview Required**: Must see impact before applying
- **Date Range Filter**: Limit to specific period
- **Locked Exclusion**: Respects category_locked flag
- **Undo Capability**: Every batch can be reverted
- **Audit Trail**: All changes logged

## Undo Process

From Admin → Rule Batches:
1. Find the batch by date/description
2. Click "Undo"
3. All transactions revert to previous category
```

### 8. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/transactions
- Open Chat Assistant
- Create a new rule
- Verify backfill prompt appears after confirmation
- Click "Yes, Apply to Past"
- Take screenshot of preview modal with before/after table
- Click Apply and verify progress bar
- Verify success message with undo link
- Navigate to http://localhost:3000/admin/batches
- Verify batch appears in history
