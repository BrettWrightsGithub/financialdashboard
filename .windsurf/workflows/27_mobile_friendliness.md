---
description: Implement responsive design and mobile-optimized UI across the application. Global UI update.
auto_execution_mode: 1
---

## Phase 3: Workflow Polish – Feature #4

**Context:** Global UI update for mobile responsiveness.  
**Goal:** Full functionality on mobile devices with optimized touch interactions.

## Responsive Breakpoints

```
Mobile:    < 640px   (sm)
Tablet:    640-1024px (md)
Desktop:   > 1024px  (lg)
```

## Steps

### 1. Create Responsive Transaction Card

Create `components/transactions/TransactionCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, Tag, Flag, MoreVertical } from 'lucide-react'

interface TransactionCardProps {
  transaction: Transaction
  onCategoryChange: (categoryId: string) => void
  onFlagToggle: (flag: 'is_transfer' | 'is_pass_through' | 'is_business') => void
}

export function TransactionCard({ transaction, onCategoryChange, onFlagToggle }: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      {/* Main Row - Always visible */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {transaction.description_clean}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {transaction.account_name} • {transaction.date}
          </p>
        </div>

        <div className="text-right ml-4">
          <p className={`font-semibold ${transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 mt-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Chip */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {/* Open category selector */}}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
        >
          <Tag className="w-3 h-3" />
          {transaction.category_name || 'Categorize'}
        </button>

        {/* Flag indicators */}
        {transaction.is_transfer && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">T</span>
        )}
        {transaction.is_pass_through && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">P</span>
        )}
      </div>

      {/* Expanded Actions */}
      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* Full Description */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Original Description</p>
            <p className="text-sm text-gray-600 mt-1">{transaction.description_raw}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onFlagToggle('is_transfer')}
              className={`flex-1 py-2.5 text-sm rounded-lg border ${
                transaction.is_transfer ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200'
              }`}
            >
              Transfer
            </button>
            <button
              onClick={() => onFlagToggle('is_pass_through')}
              className={`flex-1 py-2.5 text-sm rounded-lg border ${
                transaction.is_pass_through ? 'bg-purple-50 border-purple-200 text-purple-700' : 'border-gray-200'
              }`}
            >
              Pass-Through
            </button>
            <button
              onClick={() => onFlagToggle('is_business')}
              className={`flex-1 py-2.5 text-sm rounded-lg border ${
                transaction.is_business ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200'
              }`}
            >
              Business
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 2. Responsive Transaction List

Update `components/transactions/TransactionLedger.tsx`:

```tsx
export function TransactionLedger({ transactions, filters }) {
  return (
    <>
      {/* Desktop: Table View */}
      <div className="hidden md:block">
        <table className="w-full">
          {/* ... existing table implementation */}
        </table>
      </div>

      {/* Mobile: Card View */}
      <div className="md:hidden space-y-3">
        {transactions.map(tx => (
          <TransactionCard
            key={tx.id}
            transaction={tx}
            onCategoryChange={handleCategoryChange}
            onFlagToggle={handleFlagToggle}
          />
        ))}
      </div>
    </>
  )
}
```

### 3. Touch-Optimized Buttons

Add minimum touch target sizes:

```tsx
// Button component with min 44px touch target
export function TouchButton({ children, className, ...props }) {
  return (
    <button
      className={`min-h-[44px] min-w-[44px] ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// Apply to all interactive elements
<TouchButton onClick={handleApprove} className="px-4 py-2 bg-green-600 text-white rounded-lg">
  Approve
</TouchButton>
```

### 4. Mobile Category Selector (Bottom Sheet)

Create `components/mobile/CategoryBottomSheet.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'

interface CategoryBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (categoryId: string) => void
  categories: Category[]
}

export function CategoryBottomSheet({ isOpen, onClose, onSelect, categories }: CategoryBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Handle swipe down to close
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return

    let startY = 0
    const sheet = sheetRef.current

    function handleTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY
    }

    function handleTouchMove(e: TouchEvent) {
      const deltaY = e.touches[0].clientY - startY
      if (deltaY > 100) onClose()
    }

    sheet.addEventListener('touchstart', handleTouchStart)
    sheet.addEventListener('touchmove', handleTouchMove)

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart)
      sheet.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[70vh] overflow-hidden"
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Select Category</h3>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Category List */}
        <div className="overflow-y-auto max-h-[50vh] pb-safe">
          {Object.entries(groupByGroup(categories)).map(([group, cats]) => (
            <div key={group}>
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                {group}
              </div>
              {cats.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { onSelect(cat.id); onClose() }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

### 5. Mobile Assistant Drawer

Create `components/mobile/AssistantDrawer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'

export function MobileAssistantDrawer({ selectedTransaction }) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-30"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Half-Height Drawer */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setIsOpen(false)} />

          <div className="fixed bottom-0 left-0 right-0 h-[50vh] bg-white rounded-t-2xl z-50 flex flex-col">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold">Assistant</h3>
              <button onClick={() => setIsOpen(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Banner */}
            {selectedTransaction && (
              <div className="px-4 py-2 bg-blue-50 text-sm">
                Editing: {selectedTransaction.description_clean}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Chat messages */}
            </div>

            {/* Input */}
            <div className="p-4 border-t pb-safe">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., Categorize as Coffee..."
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-lg"
                />
                <button className="p-3 bg-blue-600 text-white rounded-lg">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
```

### 6. Safe Area Handling

Add safe area insets for notched devices:

```css
/* globals.css */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.pt-safe {
  padding-top: env(safe-area-inset-top, 0);
}
```

### 7. Hide Low-Priority Columns on Mobile

```tsx
// In table header
<th className="hidden lg:table-cell">Transaction ID</th>
<th className="hidden md:table-cell">Original Description</th>
```

### 8. Viewport Meta Tag

Ensure `app/layout.tsx` has:

```tsx
export const metadata = {
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover'
}
```

### 9. Write Tests

```typescript
describe('Mobile Responsiveness', () => {
  it('shows card view on mobile', async () => {
    // Set viewport to 375px
    // Verify cards render, not table
  })

  it('shows table on desktop', async () => {
    // Set viewport to 1200px
    // Verify table renders
  })

  it('touch targets are min 44px', () => {
    // Verify all buttons meet accessibility requirements
  })

  it('bottom sheet opens/closes correctly', () => {
    // Test swipe down to close
  })
})
```

### 10. Puppeteer Verification

Use the Puppeteer MCP server to:
- Set viewport to mobile (375x667)
- Navigate to http://localhost:3000/transactions
- Take screenshot of card layout
- Test category bottom sheet
- Test Assistant drawer at half-height
- Verify touch targets are large enough
- Set viewport to desktop, verify table layout
