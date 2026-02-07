---
description: Implement smart sorting for the Unified Transactions page with Daily Top 5 suggestions based on frequency, amount, and uncertainty scoring.
auto_execution_mode: 1
---

## Phase 3: Workflow Polish – Feature #18

**Context:** Smart sorting for the "Unified Page" (workflow 23).  
**Goal:** Surface the most important uncategorized transactions first.

## Scoring Algorithm

```
PriorityScore = (Frequency × 0.4) + (Amount × 0.3) + (Uncertainty × 0.3)
```

**Factors:**
- **Frequency (0.4)**: How often this merchant appears uncategorized
- **Amount (0.3)**: Larger amounts = higher priority (normalized 0-1)
- **Uncertainty (0.3)**: Low AI confidence = higher priority

## Steps

### 1. Create Scoring Function

Create `lib/categorization/priorityScoring.ts`:

```typescript
interface ScoringFactors {
  frequency: number      // Count of similar uncategorized transactions
  amount: number         // Absolute amount
  uncertainty: number    // 1 - confidence_score
}

export function calculatePriorityScore(factors: ScoringFactors): number {
  const { frequency, amount, uncertainty } = factors

  // Normalize frequency (cap at 10 occurrences = 1.0)
  const freqNorm = Math.min(frequency / 10, 1)

  // Normalize amount (cap at $500 = 1.0)
  const amtNorm = Math.min(amount / 500, 1)

  // Uncertainty is already 0-1 (1 - confidence)
  const uncertNorm = uncertainty

  return (freqNorm * 0.4) + (amtNorm * 0.3) + (uncertNorm * 0.3)
}

export async function getTop5Suggestions(userId: string): Promise<SuggestedTransaction[]> {
  const supabase = createClient()

  // Get uncategorized transactions with frequency count
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, description_clean, amount, date, category_confidence,
      category_ai, account_id, accounts(name)
    `)
    .is('life_category_id', null)
    .eq('status', 'posted')
    .order('date', { ascending: false })
    .limit(100)

  if (!transactions) return []

  // Count frequency by normalized merchant name
  const merchantCounts = new Map<string, number>()
  for (const tx of transactions) {
    const key = normalizeMerchant(tx.description_clean || '')
    merchantCounts.set(key, (merchantCounts.get(key) || 0) + 1)
  }

  // Score each transaction
  const scored = transactions.map(tx => {
    const merchant = normalizeMerchant(tx.description_clean || '')
    const frequency = merchantCounts.get(merchant) || 1
    const uncertainty = 1 - (tx.category_confidence || 0)

    return {
      ...tx,
      priorityScore: calculatePriorityScore({
        frequency,
        amount: Math.abs(tx.amount),
        uncertainty
      }),
      frequency,
      aiSuggestion: tx.category_ai
    }
  })

  // Sort by score descending, return top 5
  return scored
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
}

function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
}
```

### 2. Create Daily Briefing Card

Create `components/dashboard/DailyBriefingCard.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle, Wand2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function DailyBriefingCard() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/suggestions/top5')
      .then(res => res.json())
      .then(data => {
        setSuggestions(data.suggestions)
        setLoading(false)
      })
  }, [])

  if (loading) return <CardSkeleton />
  if (suggestions.length === 0) return <AllCaughtUpCard />

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h2 className="font-semibold text-gray-900">Good Morning!</h2>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        You have {suggestions.length} high-priority transactions to review.
      </p>

      <div className="space-y-3">
        {suggestions.map((tx) => (
          <SuggestionRow key={tx.id} transaction={tx} />
        ))}
      </div>

      <Link
        href="/transactions"
        className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800"
      >
        View All Transactions
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function SuggestionRow({ transaction }) {
  const [approved, setApproved] = useState(false)

  async function handleApprove() {
    await fetch(`/api/transactions/${transaction.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        life_category_id: transaction.suggestedCategoryId,
        category_locked: true
      })
    })
    setApproved(true)
  }

  if (approved) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Approved!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {transaction.description_clean}
        </p>
        <p className="text-xs text-gray-500">
          ${Math.abs(transaction.amount).toFixed(2)} • {transaction.accounts?.name}
        </p>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {transaction.aiSuggestion && (
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            title={`Accept: ${transaction.aiSuggestion}`}
          >
            <CheckCircle className="w-3 h-3 inline mr-1" />
            {transaction.aiSuggestion}
          </button>
        )}
        <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Ask Assistant">
          <Wand2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function AllCaughtUpCard() {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 text-center">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <h2 className="font-semibold text-gray-900">All Caught Up!</h2>
      <p className="text-sm text-gray-600 mt-1">
        No transactions need review right now.
      </p>
    </div>
  )
}
```

### 3. Create API Endpoint

Create `app/api/suggestions/top5/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getTop5Suggestions } from '@/lib/categorization/priorityScoring'

export async function GET() {
  const suggestions = await getTop5Suggestions()
  return NextResponse.json({ suggestions })
}
```

### 4. Add to Dashboard

Update `app/page.tsx` (Dashboard):

```tsx
import { DailyBriefingCard } from '@/components/dashboard/DailyBriefingCard'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Existing cards */}
      <CashflowCard />
      <SafeToSpendCard />
      <OutstandingInflowsCard />

      {/* New: Daily Briefing */}
      <div className="lg:col-span-3">
        <DailyBriefingCard />
      </div>
    </div>
  )
}
```

### 5. Add to Review Queue

Integrate scoring into Review Queue component:

```tsx
// In ReviewQueue.tsx
const { data: suggestions } = useSWR('/api/suggestions/top5')

// Show scored transactions first in the queue
const sortedQueue = [...reviewItems].sort((a, b) => 
  (b.priorityScore || 0) - (a.priorityScore || 0)
)
```

### 6. Daily Refresh Logic

Add timestamp-based caching:

```typescript
// Cache for 4 hours
const CACHE_TTL = 4 * 60 * 60 * 1000

export async function getTop5Suggestions() {
  const cacheKey = `top5-${new Date().toDateString()}`
  const cached = await redis.get(cacheKey)
  
  if (cached) return JSON.parse(cached)
  
  const fresh = await calculateTop5()
  await redis.setex(cacheKey, CACHE_TTL / 1000, JSON.stringify(fresh))
  return fresh
}
```

### 7. Write Tests

```typescript
describe('Priority Scoring', () => {
  it('high frequency + high amount = high score', () => {
    const score = calculatePriorityScore({ frequency: 10, amount: 500, uncertainty: 0.5 })
    expect(score).toBeGreaterThan(0.7)
  })

  it('single occurrence + small amount = low score', () => {
    const score = calculatePriorityScore({ frequency: 1, amount: 5, uncertainty: 0.1 })
    expect(score).toBeLessThan(0.2)
  })
})
```

### 8. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000
- Verify Daily Briefing card appears
- Test "Accept Suggestion" button
- Verify suggestion disappears after approval
- Navigate to /transactions
- Verify same suggestions appear in Review Queue
