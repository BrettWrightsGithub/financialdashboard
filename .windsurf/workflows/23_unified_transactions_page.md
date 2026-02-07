---
description: Merge Transactions page with Review Queue into a single unified view. Top section shows actionable items (uncategorized, suggestions), bottom shows full ledger. Merges workflow 04 and workflow 10.
auto_execution_mode: 1
---

## Phase 2: The "Assistant" Interface – Feature #17

**Context:** Merges workflow 04 (Transactions) and workflow 10 (Review Queue).  
**Research Alignment:** The "Command Center" model requires a single source of truth, not fragmented views.

## Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  GLOBAL FILTERS: Date | Account | Category | Search          │
├──────────────────────────────────────────────────────────────┤
│  REVIEW QUEUE (Collapsible)                          [▼/▲]  │
│  • Uncategorized transactions                                │
│  • Low confidence suggestions                                │
│  • Quick approve/reject actions                              │
├──────────────────────────────────────────────────────────────┤
│  TRANSACTION LEDGER (Full History)                           │
│  • Searchable, sortable table                                │
│  • Inline editing                                            │
│  • Flag toggles                                              │
├──────────────────────────────────────────────────────────────┤
│  CHAT ASSISTANT (FAB)                              [💬]      │
└──────────────────────────────────────────────────────────────┘
```

## Steps

### 1. Create Global Filters Component

Create `components/transactions/GlobalFilters.tsx`:

- **Date range picker**: Month selector + custom range
- **Account dropdown**: Filter by specific account
- **Category dropdown**: Filter by category or cashflow_group
- **Search input**: Full-text search on description
- **Flag toggles**: Show/hide transfers, pass-through, business
- Filters apply to BOTH Review Queue and Ledger sections

### 2. Create Review Queue Component

Create `components/transactions/ReviewQueue.tsx`:

**Data Sources:**
- Transactions where `life_category_id IS NULL`
- Transactions where `category_confidence < 0.7`
- Transactions with `category_source = 'plaid'` and low confidence

**UI Elements:**
- Collapsible header with transaction count badge
- Card-based layout for each review item
- Yellow border/badge for "needs review" state
- Quick actions on hover:
  - ✓ Approve (accept AI suggestion)
  - ✏️ Edit (open category dropdown)
  - 🤖 Ask Assistant (context-aware chat)

**Interaction:**
```tsx
// On approve click
async function handleApprove(transactionId: string, suggestedCategoryId: string) {
  await fetch(`/api/transactions/${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ life_category_id: suggestedCategoryId, category_locked: true })
  })
  refreshQueue()
}
```

### 3. Create Transaction Ledger Component

Create `components/transactions/TransactionLedger.tsx`:

**Columns:**
- Date
- Description (with edit indicator if modified)
- Account
- Category (inline editable dropdown)
- Amount
- Flags (T/P/B toggles)
- Actions (split, link transfer, etc.)

**Features:**
- Virtual scrolling for large datasets
- Sort by any column
- Row selection for bulk actions
- Visual distinction for review-needed rows

### 4. Update Page Layout

Update `app/transactions/page.tsx`:

```tsx
export default function UnifiedTransactionsPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [reviewExpanded, setReviewExpanded] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Filters */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <GlobalFilters filters={filters} onChange={setFilters} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Review Queue */}
        <ReviewQueue
          filters={filters}
          expanded={reviewExpanded}
          onToggle={() => setReviewExpanded(!reviewExpanded)}
          onSelect={setSelectedTransaction}
        />

        {/* Transaction Ledger */}
        <TransactionLedger
          filters={filters}
          selectedId={selectedTransaction?.id}
          onSelect={setSelectedTransaction}
        />
      </div>

      {/* Chat Assistant */}
      <ChatAssistant selectedTransaction={selectedTransaction} />
    </div>
  )
}
```

### 5. Implement Review Mode Indicators

**Visual States:**
- **Needs Review**: Yellow border, badge "Review"
- **AI Suggested**: Blue badge showing confidence %
- **Approved**: Green checkmark, no badge
- **Locked**: Lock icon on category

**CSS:**
```css
.review-needed { border-left: 4px solid #EAB308; }
.ai-suggested { border-left: 4px solid #3B82F6; }
.approved { border-left: 4px solid #22C55E; }
```

### 6. Integrate Chat Assistant Context

When a transaction row is selected:
- Pass transaction to ChatAssistant component
- Assistant shows context-aware greeting
- "Categorize this as..." commands work immediately

### 7. Add Bulk Actions Bar

When multiple transactions selected:
```tsx
<BulkActionsBar
  selectedCount={selectedIds.length}
  onCategorize={(categoryId) => bulkUpdate(selectedIds, { life_category_id: categoryId })}
  onMarkTransfer={() => bulkUpdate(selectedIds, { is_transfer: true })}
  onClear={() => setSelectedIds([])}
/>
```

### 8. API Endpoints

**GET `/api/transactions/review-queue`**
- Returns uncategorized + low-confidence transactions
- Respects global filters
- Includes AI suggestions

**GET `/api/transactions`**
- Returns full ledger with pagination
- Supports all filter parameters
- Includes category and account details

### 9. Write Tests

- GlobalFilters: Date range validation, filter state sync
- ReviewQueue: Approve/reject actions, count updates
- TransactionLedger: Sorting, inline edit, bulk select
- E2E: Full flow from filter → review → approve

### 10. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/transactions
- Verify Review Queue section appears at top
- Test collapse/expand toggle
- Test global filters affect both sections
- Select a transaction and verify Assistant context
- Take screenshot of unified layout
