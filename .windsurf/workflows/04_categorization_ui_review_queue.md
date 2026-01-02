---
description: Build the Review Queue UI where users categorize uncategorized/low-confidence transactions with bulk editing and explainability.
auto_execution_mode: 1
---

## Context

Implements FR-11 through FR-14 from the categorization MVP plan:
- Review queue for uncategorized/low-confidence transactions
- Bulk edit capability
- Categorization source indicators
- Manual split transactions

## Prerequisites

- Workflow 03 (categorization foundation) must be completed
- `lib/categorization/engine.ts` exists and works
- Database schema includes categorization fields

## Steps

### 1. Create Review Queue Page

Create `app/transactions/review/page.tsx`:

```typescript
'use client';

export default function ReviewQueuePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'uncategorized' | 'low_confidence' | 'all'>('uncategorized');
  
  // Fetch transactions based on filter
  // Display count: "23 transactions need review"
  // Show bulk action bar when items selected
  
  return (
    <div className="container mx-auto p-6">
      <h1>Transaction Review Queue</h1>
      <FilterTabs mode={filterMode} onChange={setFilterMode} />
      <ReviewTable 
        transactions={transactions}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
      <BulkActionBar 
        selectedCount={selectedIds.size}
        onCategorize={handleBulkCategorize}
      />
    </div>
  );
}
```

### 2. Create Filter Tabs Component

Create `components/transactions/FilterTabs.tsx`:

```typescript
interface FilterTabsProps {
  mode: 'uncategorized' | 'low_confidence' | 'all';
  onChange: (mode: FilterTabsProps['mode']) => void;
}

export function FilterTabs({ mode, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 mb-4">
      <button 
        className={mode === 'uncategorized' ? 'active' : ''}
        onClick={() => onChange('uncategorized')}
      >
        Uncategorized (23)
      </button>
      <button 
        className={mode === 'low_confidence' ? 'active' : ''}
        onClick={() => onChange('low_confidence')}
      >
        Low Confidence (12)
      </button>
      <button 
        className={mode === 'all' ? 'active' : ''}
        onClick={() => onChange('all')}
      >
        All Recent (100)
      </button>
    </div>
  );
}
```

### 3. Create Review Table Component

Create `components/transactions/ReviewTable.tsx`:

Key features:
- Checkbox column for multi-select
- Date, Description, Amount, Account columns
- **Source indicator** badge (FR-12): "Plaid 78%", "Rule: Groceries", "Manual", "Uncategorized"
- Category dropdown (inline edit)
- Split button for multi-category transactions
- Transfer/Pass-through flag toggles

```typescript
export function ReviewTable({ 
  transactions, 
  selectedIds, 
  onSelectionChange 
}: ReviewTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>
            <input 
              type="checkbox" 
              onChange={handleSelectAll}
              checked={selectedIds.size === transactions.length}
            />
          </th>
          <th>Date</th>
          <th>Description</th>
          <th>Account</th>
          <th>Amount</th>
          <th>Category</th>
          <th>Source</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(txn => (
          <TransactionRow 
            key={txn.id}
            transaction={txn}
            isSelected={selectedIds.has(txn.id)}
            onSelect={handleSelectOne}
            onCategorize={handleCategorize}
          />
        ))}
      </tbody>
    </table>
  );
}
```

### 4. Create Source Indicator Badge

Create `components/transactions/SourceBadge.tsx`:

Shows WHY a transaction was categorized (FR-12, FR-14):

```typescript
interface SourceBadgeProps {
  source: 'manual' | 'rule' | 'plaid' | 'payee_memory' | 'uncategorized';
  confidence?: number;
  ruleName?: string;
}

export function SourceBadge({ source, confidence, ruleName }: SourceBadgeProps) {
  const badges = {
    manual: { text: 'Manual', color: 'blue', icon: '✓' },
    rule: { text: `Rule: ${ruleName}`, color: 'green', icon: '⚙️' },
    plaid: { text: `Plaid ${Math.round((confidence || 0) * 100)}%`, color: 'gray', icon: '🏦' },
    payee_memory: { text: 'Learned', color: 'purple', icon: '🧠' },
    uncategorized: { text: 'Needs Review', color: 'yellow', icon: '⚠️' }
  };
  
  const badge = badges[source];
  
  return (
    <span className={`badge badge-${badge.color}`}>
      {badge.icon} {badge.text}
    </span>
  );
}
```

### 5. Create Bulk Action Bar

Create `components/transactions/BulkActionBar.tsx`:

Fixed bottom bar that appears when transactions are selected (FR-11):

```typescript
export function BulkActionBar({ selectedCount, onCategorize }: BulkActionBarProps) {
  const [category, setCategory] = useState<string | null>(null);
  
  if (selectedCount === 0) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
      <div className="container mx-auto flex items-center gap-4">
        <span className="font-semibold">{selectedCount} selected</span>
        
        <CategoryDropdown 
          value={category}
          onChange={setCategory}
        />
        
        <button 
          onClick={() => onCategorize(category)}
          disabled={!category}
          className="btn btn-primary"
        >
          Apply to {selectedCount} transactions
        </button>
        
        <button className="btn btn-ghost">
          Mark as Transfer
        </button>
        
        <button className="btn btn-ghost">
          Clear Selection
        </button>
      </div>
    </div>
  );
}
```

### 6. Create Transaction Split Modal

Create `components/transactions/SplitTransactionModal.tsx`:

Allows splitting one transaction into multiple categories (FR-10):

```typescript
export function SplitTransactionModal({ 
  transaction, 
  isOpen, 
  onClose 
}: SplitModalProps) {
  const [splits, setSplits] = useState<Split[]>([
    { category_id: null, amount: transaction.amount / 2 },
    { category_id: null, amount: transaction.amount / 2 }
  ]);
  
  const handleAddSplit = () => {
    setSplits([...splits, { category_id: null, amount: 0 }]);
  };
  
  const handleSaveSplits = async () => {
    // Validate splits sum to original amount
    const total = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(total - transaction.amount) > 0.01) {
      alert('Split amounts must equal original amount');
      return;
    }
    
    // Create child transactions with parent_transaction_id
    // Mark original as is_split_parent = true
    await saveSplitTransactions(transaction.id, splits);
    onClose();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Split Transaction</h2>
      <p>Original: {transaction.description_clean} - ${transaction.amount}</p>
      
      {splits.map((split, idx) => (
        <div key={idx} className="split-row">
          <CategoryDropdown 
            value={split.category_id}
            onChange={(cat) => updateSplit(idx, 'category_id', cat)}
          />
          <input 
            type="number"
            value={split.amount}
            onChange={(e) => updateSplit(idx, 'amount', parseFloat(e.target.value))}
          />
          <button onClick={() => removeSplit(idx)}>Remove</button>
        </div>
      ))}
      
      <button onClick={handleAddSplit}>Add Split</button>
      <button onClick={handleSaveSplits}>Save Splits</button>
    </Modal>
  );
}
```

### 7. Create Category Dropdown with Search

Create `components/transactions/CategoryDropdown.tsx`:

Searchable category selector grouped by cashflow_group:

```typescript
export function CategoryDropdown({ value, onChange }: CategoryDropdownProps) {
  const { data: categories } = useCategories(); // From lib/queries.ts
  
  // Group by cashflow_group
  const grouped = groupBy(categories, 'cashflow_group');
  
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select category...</option>
      {Object.entries(grouped).map(([group, cats]) => (
        <optgroup key={group} label={group}>
          {cats.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

### 8. Create Categorization API Route

Create `app/api/transactions/categorize/route.ts`:

Handles bulk categorization with audit logging:

```typescript
export async function POST(request: Request) {
  const { transaction_ids, category_id, is_transfer, is_pass_through } = await request.json();
  
  // Validate inputs
  if (!transaction_ids?.length || !category_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // For each transaction:
  // 1. Get current category
  // 2. Update category + set category_locked = true + category_source = 'manual'
  // 3. Log to category_audit_log
  // 4. Create payee override for future matches (payee memory)
  
  const results = await Promise.all(
    transaction_ids.map(async (txn_id: string) => {
      const txn = await getTransaction(txn_id);
      
      await supabase
        .from('transactions')
        .update({
          life_category_id: category_id,
          category_locked: true,
          category_source: 'manual',
          category_confidence: 1.0,
          is_transfer: is_transfer ?? txn.is_transfer,
          is_pass_through: is_pass_through ?? txn.is_pass_through,
          updated_at: new Date().toISOString()
        })
        .eq('id', txn_id);
      
      await logCategoryChange(
        txn_id,
        txn.life_category_id,
        category_id,
        'manual',
        undefined,
        1.0,
        `Bulk edit: ${transaction_ids.length} transactions`
      );
      
      // Create payee override for future learning (FR-06)
      if (txn.description_clean) {
        await createPayeeOverride(txn.description_clean, category_id);
      }
      
      return { id: txn_id, success: true };
    })
  );
  
  return Response.json({ 
    success: true, 
    updated: results.length,
    results 
  });
}
```

### 9. Add Review Queue Link to Navigation

Update `components/Navigation.tsx`:

Add "Review Queue" link with badge showing count of items needing review:

```typescript
<Link href="/transactions/review">
  Review Queue
  {needsReviewCount > 0 && (
    <span className="badge">{needsReviewCount}</span>
  )}
</Link>
```

### 10. Create Hook for Review Queue Count

Create `lib/hooks/useReviewQueueCount.ts`:

```typescript
export function useReviewQueueCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const fetchCount = async () => {
      const { count: uncategorized } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .is('life_category_id', null)
        .eq('status', 'posted')
        .eq('is_transfer', false);
      
      const { count: lowConfidence } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .lt('category_confidence', 0.7)
        .eq('category_locked', false)
        .eq('status', 'posted');
      
      setCount((uncategorized || 0) + (lowConfidence || 0));
    };
    
    fetchCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return count;
}
```

## Success Criteria

- [ ] Review queue page loads with correct transaction filters
- [ ] Multi-select checkboxes work correctly
- [ ] Bulk categorization applies to all selected transactions
- [ ] Source badges show correct categorization provenance
- [ ] Split transaction modal creates proper parent-child records
- [ ] Category dropdown groups by cashflow_group
- [ ] Audit log captures all manual categorizations
- [ ] Payee memory is created after first manual categorization
- [ ] Navigation badge shows correct count
- [ ] No TypeScript errors
- [ ] Page loads in <500ms with 100 transactions

## Notes

- Keep UI simple and functional—focus on workflow efficiency
- Use keyboard shortcuts for power users (Enter to categorize, Ctrl+A to select all)
- Show success toast after bulk operations
- Allow undo for last operation
- Consider adding quick category buttons for common categories (Groceries, Gas, Restaurants)
