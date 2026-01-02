---
description: Build the foundational data structures and database layer for the transaction categorization MVP (Phase 1).
auto_execution_mode: 1
---

## Context

This workflow implements the technical foundation for transaction categorization as defined in:
- `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md`
- `docs/financial-command-center-overview.md`
- `docs/db-schema.md`

## Steps

### 1. Review Documentation
Read and understand the categorization approach:
- MVP scope: Plaid + Programmatic Rules + Payee Memory + User Override
- Target: 80%+ auto-categorization, <5 min/week user effort
- Key requirements: TI-01 through TI-05 (see categorization plan)

### 2. Verify Schema Alignment

Check that `docs/db-schema.md` matches the categorization requirements:
- `transactions.category_locked` column exists (TI-03)
- `transactions.pending_transaction_id` column exists (TI-01)
- `transactions.applied_rule_id` column exists (TI-05)
- `transactions.category_confidence` column exists (TI-05)
- `categorization_rules` table matches MVP requirements
- `category_overrides` table supports payee memory
- `category_audit_log` table exists (create if missing)

### 3. Create TypeScript Types

In `types/database.ts`, add or update interfaces for:

```typescript
interface CategorizationRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  is_active: boolean;
  
  // Match conditions
  match_merchant_contains?: string;
  match_merchant_exact?: string;
  match_amount_min?: number;
  match_amount_max?: number;
  match_account_id?: string;
  match_account_subtype?: string;
  match_direction?: 'inflow' | 'outflow';
  
  // Assignments
  assign_category_id: string;
  assign_is_transfer?: boolean;
  assign_is_pass_through?: boolean;
  
  created_at: string;
  updated_at: string;
}

interface CategoryOverride {
  id: string;
  description_pattern: string;
  counterparty_name?: string;
  category_id: string;
  is_transfer?: boolean;
  is_pass_through?: boolean;
  is_business?: boolean;
  priority: number;
  is_active: boolean;
  source: 'manual' | 'ai' | 'rule';
  rule_id?: string;
  confidence_score?: number;
  created_from_transaction_id?: string;
  created_at: string;
}

interface CategoryAuditLog {
  id: string;
  transaction_id: string;
  previous_category_id?: string;
  new_category_id: string;
  change_source: 'manual' | 'rule' | 'plaid' | 'payee_memory' | 'bulk_edit';
  rule_id?: string;
  confidence_score?: number;
  changed_by?: string; // user_id for future multi-user
  changed_at: string;
  notes?: string;
}

interface TransactionWithCategorization extends Transaction {
  category_locked: boolean;
  category_source?: string;
  category_confidence?: number;
  applied_rule_id?: string;
  pending_transaction_id?: string;
}
```

### 4. Create Categorization Library

Create `lib/categorization/engine.ts` with the core categorization engine:

```typescript
/**
 * Categorization precedence (highest to lowest):
 * 1. User Override (category_locked = TRUE)
 * 2. Programmatic Rules (priority-ordered)
 * 3. Payee Memory (from category_overrides)
 * 4. Plaid Baseline
 */

export async function categorizeTransaction(transaction: Transaction): Promise<CategorizationResult> {
  // Check if manually locked
  if (transaction.category_locked) {
    return {
      category_id: transaction.life_category_id,
      source: 'manual',
      confidence: 1.0,
      rule_id: null
    };
  }
  
  // Check programmatic rules (priority order)
  const ruleMatch = await findMatchingRule(transaction);
  if (ruleMatch) {
    return {
      category_id: ruleMatch.assign_category_id,
      source: 'rule',
      confidence: 0.95,
      rule_id: ruleMatch.id
    };
  }
  
  // Check payee memory
  const payeeMatch = await findPayeeOverride(transaction);
  if (payeeMatch) {
    return {
      category_id: payeeMatch.category_id,
      source: 'payee_memory',
      confidence: 0.90,
      rule_id: null
    };
  }
  
  // Fall back to Plaid
  if (transaction.category_ai) {
    return {
      category_id: await mapPlaidCategoryToOurs(transaction.category_ai),
      source: 'plaid',
      confidence: (transaction.category_ai_conf || 75) / 100,
      rule_id: null
    };
  }
  
  return {
    category_id: null,
    source: 'uncategorized',
    confidence: 0,
    rule_id: null
  };
}
```

### 5. Create Transfer Detection Logic

Create `lib/categorization/transfer-detection.ts`:

```typescript
/**
 * Transfer detection heuristics (TI-01, FR-07, FR-08)
 * 
 * Rules:
 * - Same-owner accounts within 3 days, matching amounts = internal transfer
 * - Venmo/Zelle/PayPal to external parties = expense (unless flagged)
 * - Credit card payments from checking = transfer
 */

export async function detectTransfer(transaction: Transaction): Promise<TransferDetectionResult> {
  // Check for P2P providers
  const p2pProviders = ['venmo', 'zelle', 'paypal'];
  const isP2P = p2pProviders.some(p => 
    transaction.description_clean?.toLowerCase().includes(p)
  );
  
  if (isP2P) {
    // Check if counterparty is external
    const isExternal = await isExternalCounterparty(transaction.counterparty_id);
    return {
      is_transfer: !isExternal, // External P2P = expense
      transfer_subtype: isExternal ? 'external_p2p' : 'internal',
      confidence: 0.85
    };
  }
  
  // Check for matching opposite transaction (same amount, opposite sign)
  const matchingTransfer = await findMatchingTransferPair(transaction);
  if (matchingTransfer) {
    return {
      is_transfer: true,
      transfer_subtype: 'internal',
      matched_transaction_id: matchingTransfer.id,
      confidence: 0.95
    };
  }
  
  return {
    is_transfer: false,
    confidence: 0.90
  };
}
```

### 6. Create Audit Log Writer

Create `lib/categorization/audit.ts`:

```typescript
export async function logCategoryChange(
  transaction_id: string,
  previous_category_id: string | null,
  new_category_id: string,
  source: CategorySource,
  rule_id?: string,
  confidence?: number,
  notes?: string
): Promise<void> {
  await supabase.from('category_audit_log').insert({
    transaction_id,
    previous_category_id,
    new_category_id,
    change_source: source,
    rule_id,
    confidence_score: confidence,
    changed_at: new Date().toISOString(),
    notes
  });
}
```

### 7. Create Pending Transaction Handler

Create `lib/categorization/pending-handler.ts` to implement TI-01:

```typescript
/**
 * Handles pending → posted transaction transitions
 * Preserves user categorizations (TI-01)
 */

export async function handlePendingToPosted(
  pendingTransaction: Transaction,
  postedTransaction: Transaction
): Promise<void> {
  // If user manually categorized pending transaction
  if (pendingTransaction.category_locked) {
    // Copy categorization to posted transaction
    await supabase.from('transactions')
      .update({
        life_category_id: pendingTransaction.life_category_id,
        category_locked: true,
        category_source: 'manual',
        pending_transaction_id: pendingTransaction.provider_transaction_id
      })
      .eq('id', postedTransaction.id);
    
    await logCategoryChange(
      postedTransaction.id,
      postedTransaction.life_category_id,
      pendingTransaction.life_category_id,
      'manual',
      undefined,
      1.0,
      'Copied from pending transaction'
    );
  }
}
```

### 8. Create Database Migration Template

Create a markdown file documenting required DB changes:
`docs/categorization/db-migration-checklist.md`

List all schema additions needed:
- `category_audit_log` table creation
- Any missing columns in `transactions`
- Indexes for performance (on `category_locked`, `applied_rule_id`, etc.)

### 9. Add Categorization Queries

In `lib/queries.ts`, add:

```typescript
export async function getUncategorizedTransactions(limit = 50) {
  return supabase
    .from('transactions')
    .select('*, accounts(name, institution), categories(name, color)')
    .is('life_category_id', null)
    .eq('status', 'posted')
    .eq('is_transfer', false)
    .order('date', { ascending: false })
    .limit(limit);
}

export async function getLowConfidenceTransactions(threshold = 0.7, limit = 50) {
  return supabase
    .from('transactions')
    .select('*, accounts(name, institution), categories(name, color)')
    .lt('category_confidence', threshold)
    .eq('status', 'posted')
    .eq('category_locked', false)
    .order('date', { ascending: false })
    .limit(limit);
}

export async function getRulesByPriority() {
  return supabase
    .from('categorization_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });
}

export async function getPayeeOverrides() {
  return supabase
    .from('category_overrides')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });
}
```

### 10. Document API Contracts

Create `docs/categorization/api-contracts.md` documenting:
- Input/output schemas for categorization functions
- Expected error handling
- Performance SLAs (<100ms per transaction)

## Success Criteria

- [ ] All TypeScript types match schema
- [ ] Core categorization engine follows precedence order
- [ ] Transfer detection logic implements MVP heuristics
- [ ] Audit logging captures all changes with provenance
- [ ] Pending transaction handler preserves user work
- [ ] Database queries are performant (<200ms)
- [ ] No TypeScript errors
- [ ] Unit tests pass (if written)

## Notes

- DO NOT implement UI in this workflow - this is foundation only
- Focus on correctness over performance initially
- All functions should be pure/testable where possible
- Use clear error messages for debugging
