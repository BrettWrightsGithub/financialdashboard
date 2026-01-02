---
description: Build the programmatic rules engine UI and backend for creating, testing, and managing categorization rules.
auto_execution_mode: 1
---

## Context

Implements FR-03, FR-04, FR-15, FR-16 from categorization MVP:
- Rule creation and management
- Priority ordering
- Retroactive rule application
- Rule conflict detection

## Prerequisites

- Workflow 03 (categorization foundation) completed
- `lib/categorization/engine.ts` has `findMatchingRule()` function
- Database has `categorization_rules` table

## Steps

### 1. Create Rules Management Page

Create `app/rules/page.tsx`:

```typescript
'use client';

export default function RulesPage() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1>Categorization Rules</h1>
        <button onClick={() => setIsCreating(true)}>
          + New Rule
        </button>
      </div>
      
      <RulesTable 
        rules={rules}
        onReorder={handleReorder}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
      />
      
      {isCreating && (
        <RuleEditor 
          rule={null}
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}
```

### 2. Create Rules Table Component

Create `components/rules/RulesTable.tsx`:

Drag-and-drop priority ordering (FR-04):

```typescript
export function RulesTable({ 
  rules, 
  onReorder, 
  onEdit, 
  onDelete, 
  onToggle 
}: RulesTableProps) {
  return (
    <div className="rules-table">
      <div className="table-header">
        <span>Priority</span>
        <span>Name</span>
        <span>Conditions</span>
        <span>Category</span>
        <span>Status</span>
        <span>Matches</span>
        <span>Actions</span>
      </div>
      
      {rules.map((rule, index) => (
        <RuleRow 
          key={rule.id}
          rule={rule}
          index={index}
          totalRules={rules.length}
          onMoveUp={() => onReorder(rule.id, 'up')}
          onMoveDown={() => onReorder(rule.id, 'down')}
          onEdit={() => onEdit(rule)}
          onDelete={() => onDelete(rule.id)}
          onToggle={() => onToggle(rule.id)}
        />
      ))}
    </div>
  );
}
```

### 3. Create Rule Row Component

Create `components/rules/RuleRow.tsx`:

Shows rule details with inline controls:

```typescript
export function RuleRow({ 
  rule, 
  index, 
  totalRules, 
  onMoveUp, 
  onMoveDown, 
  onEdit, 
  onDelete, 
  onToggle 
}: RuleRowProps) {
  const conditions = buildConditionsSummary(rule);
  const matchCount = useRuleMatchCount(rule.id); // Live count of matching transactions
  
  return (
    <div className={`rule-row ${!rule.is_active ? 'disabled' : ''}`}>
      <div className="priority">
        <button onClick={onMoveUp} disabled={index === 0}>↑</button>
        <span>{index + 1}</span>
        <button onClick={onMoveDown} disabled={index === totalRules - 1}>↓</button>
      </div>
      
      <div className="name">{rule.name}</div>
      
      <div className="conditions">
        {conditions.map((cond, i) => (
          <span key={i} className="condition-badge">{cond}</span>
        ))}
      </div>
      
      <div className="category">
        <CategoryBadge categoryId={rule.assign_category_id} />
      </div>
      
      <div className="status">
        <Toggle checked={rule.is_active} onChange={onToggle} />
      </div>
      
      <div className="matches">
        {matchCount} transactions
      </div>
      
      <div className="actions">
        <button onClick={onEdit}>Edit</button>
        <button onClick={() => handleTestRule(rule)}>Test</button>
        <button onClick={() => handleApplyRetroactive(rule)}>Apply to Past</button>
        <button onClick={onDelete} className="danger">Delete</button>
      </div>
    </div>
  );
}
```

### 4. Create Rule Editor Component

Create `components/rules/RuleEditor.tsx`:

Form for creating/editing rules:

```typescript
export function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps) {
  const [formData, setFormData] = useState<Partial<CategorizationRule>>(
    rule || {
      name: '',
      description: '',
      priority: 0,
      is_active: true,
      assign_category_id: ''
    }
  );
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  
  return (
    <div className="rule-editor">
      <h2>{rule ? 'Edit Rule' : 'New Rule'}</h2>
      
      {/* Basic Info */}
      <div className="form-section">
        <label>Rule Name</label>
        <input 
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Starbucks → Coffee"
        />
        
        <label>Description (optional)</label>
        <input 
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Why this rule exists"
        />
      </div>
      
      {/* Match Conditions */}
      <div className="form-section">
        <h3>Match Conditions (ALL must be true)</h3>
        
        <label>Merchant Name</label>
        <div className="flex gap-2">
          <select 
            value={formData.match_merchant_exact ? 'exact' : 'contains'}
            onChange={(e) => handleMerchantTypeChange(e.target.value)}
          >
            <option value="contains">Contains</option>
            <option value="exact">Exact match</option>
          </select>
          <input 
            value={formData.match_merchant_contains || formData.match_merchant_exact || ''}
            onChange={handleMerchantValueChange}
            placeholder="e.g., Starbucks"
          />
        </div>
        
        <label>Amount Range</label>
        <div className="flex gap-2">
          <input 
            type="number"
            value={formData.match_amount_min || ''}
            onChange={(e) => setFormData({ ...formData, match_amount_min: parseFloat(e.target.value) })}
            placeholder="Min"
          />
          <span>to</span>
          <input 
            type="number"
            value={formData.match_amount_max || ''}
            onChange={(e) => setFormData({ ...formData, match_amount_max: parseFloat(e.target.value) })}
            placeholder="Max"
          />
        </div>
        
        <label>Account Type</label>
        <select 
          value={formData.match_account_subtype || ''}
          onChange={(e) => setFormData({ ...formData, match_account_subtype: e.target.value })}
        >
          <option value="">Any account</option>
          <option value="checking">Checking only</option>
          <option value="credit_card">Credit card only</option>
          <option value="savings">Savings only</option>
        </select>
        
        <label>Direction</label>
        <select 
          value={formData.match_direction || ''}
          onChange={(e) => setFormData({ ...formData, match_direction: e.target.value as any })}
        >
          <option value="">Any</option>
          <option value="inflow">Inflow only</option>
          <option value="outflow">Outflow only</option>
        </select>
      </div>
      
      {/* Assignments */}
      <div className="form-section">
        <h3>Assign Category</h3>
        
        <CategoryDropdown 
          value={formData.assign_category_id}
          onChange={(cat) => setFormData({ ...formData, assign_category_id: cat })}
        />
        
        <label>
          <input 
            type="checkbox"
            checked={formData.assign_is_transfer || false}
            onChange={(e) => setFormData({ ...formData, assign_is_transfer: e.target.checked })}
          />
          Mark as transfer
        </label>
        
        <label>
          <input 
            type="checkbox"
            checked={formData.assign_is_pass_through || false}
            onChange={(e) => setFormData({ ...formData, assign_is_pass_through: e.target.checked })}
          />
          Mark as pass-through
        </label>
      </div>
      
      {/* Test Section */}
      <div className="form-section">
        <button onClick={handleTestRule}>Test Rule</button>
        
        {testResults.length > 0 && (
          <div className="test-results">
            <h4>Test Results: {testResults.length} matching transactions</h4>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Current Category</th>
                  <th>Would Become</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map(result => (
                  <TestResultRow key={result.id} result={result} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="form-actions">
        <button onClick={handleSave} className="primary">
          Save Rule
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

### 5. Create Rule Testing Logic

Create `lib/categorization/rule-tester.ts`:

Tests rule against recent transactions without modifying them:

```typescript
export async function testRule(
  rule: Partial<CategorizationRule>,
  limit = 100
): Promise<TestResult[]> {
  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'posted')
    .order('date', { ascending: false })
    .limit(limit);
  
  // Filter transactions that match rule conditions
  const matches = transactions.filter(txn => {
    if (rule.match_merchant_contains && 
        !txn.description_clean?.toLowerCase().includes(rule.match_merchant_contains.toLowerCase())) {
      return false;
    }
    
    if (rule.match_merchant_exact && 
        txn.description_clean?.toLowerCase() !== rule.match_merchant_exact.toLowerCase()) {
      return false;
    }
    
    if (rule.match_amount_min && txn.amount < rule.match_amount_min) {
      return false;
    }
    
    if (rule.match_amount_max && txn.amount > rule.match_amount_max) {
      return false;
    }
    
    if (rule.match_direction) {
      const isInflow = txn.amount > 0;
      if (rule.match_direction === 'inflow' && !isInflow) return false;
      if (rule.match_direction === 'outflow' && isInflow) return false;
    }
    
    return true;
  });
  
  // Return with current and proposed categories
  return matches.map(txn => ({
    id: txn.id,
    date: txn.date,
    description: txn.description_clean,
    amount: txn.amount,
    current_category_id: txn.life_category_id,
    proposed_category_id: rule.assign_category_id
  }));
}
```

### 6. Create Retroactive Application Logic

Create `lib/categorization/retroactive-apply.ts`:

Implements FR-15 with TI-04 safety (idempotent, preview):

```typescript
export async function applyRuleRetroactively(
  ruleId: string,
  options: {
    preview?: boolean; // If true, return changes without applying
    startDate?: string; // Limit to transactions after this date
    endDate?: string;
  } = {}
): Promise<RetroactiveApplicationResult> {
  const { preview = false, startDate, endDate } = options;
  
  // Get rule
  const { data: rule } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('id', ruleId)
    .single();
  
  if (!rule) throw new Error('Rule not found');
  
  // Find all matching transactions WHERE category_locked = FALSE (TI-03)
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('status', 'posted')
    .eq('category_locked', false);
  
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  
  const { data: transactions } = await query;
  
  // Filter to only those matching rule conditions
  const matches = transactions.filter(txn => matchesRule(txn, rule));
  
  if (preview) {
    return {
      rule_id: ruleId,
      rule_name: rule.name,
      matched_count: matches.length,
      transactions: matches.map(txn => ({
        id: txn.id,
        description: txn.description_clean,
        current_category: txn.life_category_id,
        new_category: rule.assign_category_id
      })),
      applied: false
    };
  }
  
  // Apply changes
  const batch_id = crypto.randomUUID();
  const results = await Promise.all(
    matches.map(async (txn) => {
      await supabase
        .from('transactions')
        .update({
          life_category_id: rule.assign_category_id,
          is_transfer: rule.assign_is_transfer ?? txn.is_transfer,
          is_pass_through: rule.assign_is_pass_through ?? txn.is_pass_through,
          category_source: 'rule',
          applied_rule_id: ruleId,
          category_confidence: 0.95,
          category_batch_id: batch_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', txn.id);
      
      await logCategoryChange(
        txn.id,
        txn.life_category_id,
        rule.assign_category_id,
        'rule',
        ruleId,
        0.95,
        `Retroactive application: ${rule.name}`
      );
      
      return { id: txn.id, success: true };
    })
  );
  
  // Log batch operation
  await supabase.from('category_batches').insert({
    id: batch_id,
    operation_type: 'rule_apply_retroactive',
    rule_id: ruleId,
    description: `Retroactive application of rule: ${rule.name}`,
    transaction_count: matches.length
  });
  
  return {
    rule_id: ruleId,
    rule_name: rule.name,
    matched_count: matches.length,
    applied_count: results.filter(r => r.success).length,
    batch_id,
    applied: true
  };
}
```

### 7. Create Undo Batch Operation

Create `lib/categorization/undo-batch.ts`:

Implements FR-16:

```typescript
export async function undoBatchOperation(batchId: string): Promise<UndoResult> {
  // Get batch details
  const { data: batch } = await supabase
    .from('category_batches')
    .select('*')
    .eq('id', batchId)
    .single();
  
  if (!batch) throw new Error('Batch not found');
  
  // Get audit log entries for this batch
  const { data: auditEntries } = await supabase
    .from('category_audit_log')
    .select('*')
    .eq('change_source', 'rule')
    .gte('changed_at', batch.created_at);
  
  // Revert each transaction to previous category
  const results = await Promise.all(
    auditEntries.map(async (entry) => {
      await supabase
        .from('transactions')
        .update({
          life_category_id: entry.previous_category_id,
          applied_rule_id: null,
          category_source: 'manual', // Or retrieve from earlier audit entry
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.transaction_id);
      
      await logCategoryChange(
        entry.transaction_id,
        entry.new_category_id,
        entry.previous_category_id,
        'manual',
        undefined,
        1.0,
        `Undo batch operation: ${batchId}`
      );
      
      return { id: entry.transaction_id, success: true };
    })
  );
  
  return {
    batch_id: batchId,
    reverted_count: results.filter(r => r.success).length,
    success: true
  };
}
```

### 8. Create Rule Conflict Detector

Create `lib/categorization/conflict-detector.ts`:

Checks for overlapping rules (TI-04):

```typescript
export async function detectRuleConflicts(
  newRule: Partial<CategorizationRule>
): Promise<ConflictDetectionResult> {
  // Get all active rules
  const { data: existingRules } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true);
  
  // Test new rule against sample transactions
  const newRuleMatches = await testRule(newRule, 200);
  
  // For each existing rule, check for overlaps
  const conflicts: RuleConflict[] = [];
  
  for (const existingRule of existingRules) {
    const existingMatches = await testRule(existingRule, 200);
    
    // Find transactions matched by both rules
    const overlapping = newRuleMatches.filter(txn => 
      existingMatches.some(t => t.id === txn.id)
    );
    
    if (overlapping.length > 0) {
      conflicts.push({
        existing_rule_id: existingRule.id,
        existing_rule_name: existingRule.name,
        existing_priority: existingRule.priority,
        overlapping_transaction_count: overlapping.length,
        sample_transactions: overlapping.slice(0, 5) // Show first 5
      });
    }
  }
  
  return {
    has_conflicts: conflicts.length > 0,
    conflicts,
    recommendation: conflicts.length > 0 
      ? 'Consider adjusting rule conditions to reduce overlap, or set appropriate priority.'
      : 'No conflicts detected'
  };
}
```

### 9. Add Rules Link to Navigation

Update `components/Navigation.tsx`:

```typescript
<Link href="/rules">
  Rules ({activeRulesCount})
</Link>
```

### 10. Create API Routes

Create `app/api/rules/route.ts` for CRUD operations:

```typescript
export async function GET(request: Request) {
  const { data: rules } = await supabase
    .from('categorization_rules')
    .select('*, categories(name, color)')
    .order('priority', { ascending: false });
  
  return Response.json({ rules });
}

export async function POST(request: Request) {
  const rule = await request.json();
  
  // Detect conflicts before creating
  const conflicts = await detectRuleConflicts(rule);
  
  const { data, error } = await supabase
    .from('categorization_rules')
    .insert(rule)
    .select()
    .single();
  
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  
  return Response.json({ rule: data, conflicts });
}
```

## Success Criteria

- [ ] Rules can be created with all match conditions
- [ ] Rule testing shows correct matches without modifying data
- [ ] Priority ordering works via drag-and-drop or up/down buttons
- [ ] Retroactive application works with preview mode
- [ ] Undo batch operation reverts all changes correctly
- [ ] Conflict detection identifies overlapping rules
- [ ] Rules respect category_locked flag (never override manual categorizations)
- [ ] Audit log tracks all rule-based changes
- [ ] No TypeScript errors
- [ ] Rule application completes in <5 seconds for 1000 transactions

## Notes

- Add confirmation dialog for retroactive application with preview
- Show progress indicator for long-running batch operations
- Consider rate limiting for testing large rule sets
- Add export/import for rules (JSON format)
- Future: Add rule suggestions based on user corrections (FR-17 from Phase 2)
