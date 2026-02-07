---
description: Implement visual hierarchy for split transactions with tree view showing parent-child relationships. Extends workflow 09.
auto_execution_mode: 1
---

## Phase 3: Workflow Polish – Feature #3

**Context:** Extends workflow 09 (Transaction Splitting).  
**Goal:** Clear visual representation of split transactions in the transaction list.

## Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Amazon Purchase                     $150.00  [Expand ▼] │
│   └── 🛒 Groceries                      $80.00             │
│   └── 🏠 Home Goods                     $50.00             │
│   └── 🎁 Gifts                          $20.00             │
└─────────────────────────────────────────────────────────────┘
```

**Collapsed View:**
- Parent shows total amount
- Indicator shows it's split (e.g., "3 splits")
- Click to expand

**Expanded View:**
- Tree structure with indented children
- Each child shows category + amount
- Sum of children = parent amount

## Steps

### 1. Create Split Transaction Tree Component

Create `components/transactions/SplitTransactionTree.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Split, Trash2, Edit2, AlertTriangle } from 'lucide-react'

interface SplitTransactionTreeProps {
  parent: Transaction
  children: Transaction[]
  onEditChild: (childId: string) => void
  onDeleteChild: (childId: string) => void
  onEditParent: (parentId: string) => void
}

export function SplitTransactionTree({
  parent,
  children,
  onEditChild,
  onDeleteChild,
  onEditParent
}: SplitTransactionTreeProps) {
  const [expanded, setExpanded] = useState(false)

  const childSum = children.reduce((sum, c) => sum + Math.abs(c.amount), 0)
  const parentAmount = Math.abs(parent.amount)
  const hasDiscrepancy = Math.abs(childSum - parentAmount) > 0.01

  return (
    <div className="border rounded-lg bg-white">
      {/* Parent Row */}
      <div
        className="flex items-center p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="mr-2 text-gray-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <Split className="w-4 h-4 text-purple-500 mr-2" />

        <div className="flex-1">
          <span className="font-medium">{parent.description_clean}</span>
          <span className="ml-2 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
            {children.length} splits
          </span>
        </div>

        <div className="text-right">
          <span className="font-medium">${parentAmount.toFixed(2)}</span>
          <span className="text-xs text-gray-500 ml-2">{parent.date}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onEditParent(parent.id) }}
          className="ml-3 p-1 text-gray-400 hover:text-gray-600"
          title="Edit parent (will reset splits)"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Children */}
      {expanded && (
        <div className="border-t bg-gray-50 p-3 pl-10">
          {hasDiscrepancy && (
            <div className="flex items-center gap-2 text-amber-700 text-xs mb-3 p-2 bg-amber-50 rounded">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Split amounts (${childSum.toFixed(2)}) don't match parent (${parentAmount.toFixed(2)})
              </span>
            </div>
          )}

          <div className="space-y-2">
            {children.map((child, index) => (
              <div
                key={child.id}
                className="flex items-center p-2 bg-white rounded border"
              >
                <div className="w-6 text-gray-300 text-sm">└─</div>

                <div className="flex-1 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: child.category_color || '#gray' }}
                  />
                  <span className="text-sm">{child.category_name || 'Uncategorized'}</span>
                </div>

                <span className="text-sm font-medium mr-4">
                  ${Math.abs(child.amount).toFixed(2)}
                </span>

                <div className="flex gap-1">
                  <button
                    onClick={() => onEditChild(child.id)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Edit category"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteChild(child.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete split"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Split Button */}
          <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
            + Add another split
          </button>
        </div>
      )}
    </div>
  )
}
```

### 2. Update Transaction Table to Group Splits

Update `components/transactions/TransactionLedger.tsx`:

```tsx
// Group transactions by parent
function groupTransactions(transactions: Transaction[]) {
  const groups = new Map<string, { parent: Transaction; children: Transaction[] }>()
  const standalone: Transaction[] = []

  for (const tx of transactions) {
    if (tx.is_split_parent) {
      groups.set(tx.id, { parent: tx, children: [] })
    } else if (tx.parent_transaction_id) {
      const group = groups.get(tx.parent_transaction_id)
      if (group) group.children.push(tx)
    } else {
      standalone.push(tx)
    }
  }

  return { groups: Array.from(groups.values()), standalone }
}

// In render:
const { groups, standalone } = groupTransactions(transactions)

return (
  <div className="space-y-2">
    {/* Split Transaction Groups */}
    {groups.map(({ parent, children }) => (
      <SplitTransactionTree
        key={parent.id}
        parent={parent}
        children={children}
        onEditChild={handleEditChild}
        onDeleteChild={handleDeleteChild}
        onEditParent={handleEditParent}
      />
    ))}

    {/* Regular Transactions */}
    {standalone.map(tx => (
      <TransactionRow key={tx.id} transaction={tx} />
    ))}
  </div>
)
```

### 3. Handle Delete Child with Redistribution

Create `lib/transactions/splitOperations.ts`:

```typescript
export async function deleteChildTransaction(
  childId: string,
  redistributeToParent: boolean = false
): Promise<void> {
  const supabase = createClient()

  // Get child and parent info
  const { data: child } = await supabase
    .from('transactions')
    .select('id, amount, parent_transaction_id')
    .eq('id', childId)
    .single()

  if (!child?.parent_transaction_id) {
    throw new Error('Not a split child transaction')
  }

  // Delete the child
  await supabase.from('transactions').delete().eq('id', childId)

  // Check remaining children
  const { data: siblings } = await supabase
    .from('transactions')
    .select('id')
    .eq('parent_transaction_id', child.parent_transaction_id)

  // If no children left, convert parent back to regular transaction
  if (!siblings || siblings.length === 0) {
    await supabase
      .from('transactions')
      .update({ is_split_parent: false })
      .eq('id', child.parent_transaction_id)
  }
}
```

### 4. Edit Parent Warning Modal

Create `components/transactions/EditParentWarning.tsx`:

```tsx
export function EditParentWarning({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="font-semibold">Edit Split Parent</h3>
        </div>

        <p className="text-gray-600 mb-4">
          Editing the parent transaction will <strong>reset all split categories</strong>.
          The split amounts will be preserved, but you'll need to re-categorize each split.
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border rounded">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded">
            Continue Editing
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 5. Add CSS for Tree Lines

```css
/* Tree connector lines */
.split-tree-line {
  position: relative;
}
.split-tree-line::before {
  content: '';
  position: absolute;
  left: 1.25rem;
  top: 0;
  bottom: 50%;
  width: 1px;
  background: #e5e7eb;
}
.split-tree-line::after {
  content: '';
  position: absolute;
  left: 1.25rem;
  top: 50%;
  width: 0.75rem;
  height: 1px;
  background: #e5e7eb;
}
```

### 6. Write Tests

```typescript
describe('Split Transaction Tree', () => {
  it('renders parent with child count', () => {
    // Test collapsed view shows "3 splits"
  })

  it('expands to show children', () => {
    // Test click expands tree
  })

  it('shows discrepancy warning when amounts mismatch', () => {
    // Test warning appears
  })

  it('handles delete child correctly', () => {
    // Test child removal
  })
})
```

### 7. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/transactions
- Find a split transaction
- Take screenshot of collapsed view
- Click to expand, screenshot expanded tree
- Test edit/delete child actions
- Test edit parent warning modal
