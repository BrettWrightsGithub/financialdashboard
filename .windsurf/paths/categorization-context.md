# Categorization MVP Context

This file provides essential context for the transaction categorization feature. Reference this when working on categorization-related code.

## Key Documents

**ALWAYS read these files when working on categorization:**

1. `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` - Complete MVP requirements, technical requirements (TI-01 through TI-05), and validation plan
2. `docs/financial-command-center-overview.md` - Overall system design, categorization strategy (Section 4)
3. `docs/db-schema.md` - Database schema for all categorization tables

## Critical Requirements (Technical Implementation)

### TI-01: Pending Transaction ID Tracking
- **Problem:** User corrections on pending transactions are lost when transaction settles (~2 days)
- **Solution:** Track `pending_transaction_id` in transactions table; copy categorization from pending to posted
- **Code location:** `lib/categorization/pending-handler.ts`

### TI-02: Cursor-Based Incremental Sync
- **Problem:** Full history refetches can overwrite historical data
- **Solution:** Use Plaid's `/transactions/sync` with cursor-based delta fetching
- **Code location:** Plaid sync logic (to be implemented)

### TI-03: Category Locked Flag
- **Problem:** Automated processes (rules, re-syncs) can overwrite user corrections
- **Solution:** Add `category_locked` boolean; rule engine checks `WHERE category_locked = FALSE`
- **Field:** `transactions.category_locked`
- **Usage:** ALWAYS check this before applying automated categorization

### TI-04: Idempotent Backfill Jobs
- **Problem:** Bad rules could destroy history in retroactive application
- **Solution:** All retroactive jobs must be idempotent with dry-run preview
- **Code location:** `lib/categorization/retroactive-apply.ts`

### TI-05: Expanded Provenance Schema
- **Problem:** Debugging requires knowing exactly why a transaction was categorized
- **Solution:** Store `rule_id`, `confidence_score`, `change_source` in audit log
- **Table:** `category_audit_log`

## Categorization Precedence (Waterfall)

**Always follow this order (highest to lowest priority):**

1. **User Override** - `category_locked = TRUE` → NEVER change
2. **Programmatic Rules** - Priority-ordered; highest priority wins
3. **Payee Memory** - From `category_overrides` after first manual categorization
4. **Plaid Baseline** - Default from provider enrichment (75-85% accuracy)

**Code location:** `lib/categorization/engine.ts` → `categorizeTransaction()`

## Transfer Detection Rules

**Critical for cashflow accuracy:**

- **Internal transfers:** Same-owner accounts, matching amounts within 3 days, opposite signs
- **P2P external:** Venmo/Zelle/PayPal to external parties = EXPENSE (not transfer)
- **Credit card payments:** From checking to CC = transfer
- **Always set:** `is_transfer` flag to exclude from cashflow

**Code location:** `lib/categorization/transfer-detection.ts`

## Database Tables

### Core Tables
- `transactions` - Master ledger; includes `category_locked`, `pending_transaction_id`, `applied_rule_id`, `category_confidence`
- `categories` - Category definitions with `cashflow_group` mapping
- `categorization_rules` - Programmatic rules with priority ordering
- `category_overrides` - Payee memory for learned patterns
- `category_audit_log` - Full provenance tracking for all changes
- `category_batches` - Tracks bulk operations for undo capability

### Key Fields on Transactions
- `life_category_id` - Final assigned category (FK to categories)
- `category_locked` - TRUE if manually set; prevents auto-changes
- `category_source` - 'manual', 'rule', 'plaid', 'payee_memory'
- `category_confidence` - 0.0 to 1.0 score
- `applied_rule_id` - Which rule assigned this category
- `pending_transaction_id` - Links to pending version for persistence
- `is_transfer` - Exclude from cashflow when TRUE
- `is_pass_through` - Reimbursed expenses (T-Mobile, etc.)
- `is_business` - Business-related transactions

## MVP Success Metrics

Target these when building:

- **80%+ auto-categorization** - Plaid + Rules + Payee memory should handle 4 out of 5 transactions
- **<5 min/week user effort** - Review queue should be small and fast to clear
- **<100ms rule execution** - Per-transaction categorization must be fast
- **100% explainability** - Every transaction shows WHY it was categorized
- **0% override loss** - Manual categorizations MUST persist forever

## Functional Requirements Quick Reference

### P0 (Must Have for MVP)
- FR-01: Plaid integration
- FR-02: Plaid category passthrough
- FR-03: Programmatic rule engine (merchant, amount, account type, direction)
- FR-04: Rule priority ordering
- FR-05: User override persistence
- FR-06: Payee memory (learns after first manual categorization)
- FR-07: Transfer detection (internal)
- FR-08: P2P payment handling (external = expense)
- FR-09: Reimbursement flow (link to original expense)
- FR-10: Manual split transactions (parent-child model)
- FR-11: Bulk edit (multi-select + assign category)
- FR-12: Categorization source indicator ("Plaid", "Rule: [name]", "Manual")
- FR-13: Review queue (uncategorized/low-confidence)
- FR-14: Audit log (timestamp, source, previous value)

### P1 (Important Follow-up)
- FR-15: Retroactive rule application
- FR-16: Undo batch changes
- FR-17: Confidence score display
- FR-18: Explicit category lock toggle

## Deferred to Phase 2+
- Custom ML model (XGBoost/LightGBM)
- LLM + RAG for edge cases
- Auto rule suggestions
- Amazon/receipt itemization
- Spending velocity alerts
- Drift detection

## Common Pitfalls

1. **Don't overwrite user overrides** - Always check `category_locked`
2. **Don't forget audit logging** - Every change needs provenance
3. **Don't lose pending categorizations** - Implement TI-01
4. **Don't create rule conflicts** - Test for overlaps
5. **Don't skip explainability** - Users need to know WHY
6. **Don't ignore transfer detection** - Critical for cashflow accuracy
7. **Don't batch without undo** - Must support reverting bad changes

## File Structure

```
lib/
├── categorization/
│   ├── engine.ts              # Core categorization logic (precedence waterfall)
│   ├── transfer-detection.ts  # Internal vs external transfer detection
│   ├── audit.ts               # Audit log writer
│   ├── pending-handler.ts     # Pending→posted preservation
│   ├── rule-tester.ts         # Test rules without applying
│   ├── retroactive-apply.ts   # Batch rule application with preview
│   ├── conflict-detector.ts   # Find overlapping rules
│   └── undo-batch.ts          # Revert batch operations

components/
├── transactions/
│   ├── ReviewTable.tsx        # Transaction review UI
│   ├── FilterTabs.tsx         # Uncategorized/low-confidence filters
│   ├── SourceBadge.tsx        # Explainability indicator
│   ├── BulkActionBar.tsx      # Multi-select categorization
│   ├── SplitTransactionModal.tsx  # Multi-category splits
│   └── CategoryDropdown.tsx   # Category selector
├── rules/
│   ├── RulesTable.tsx         # Rule management table
│   ├── RuleRow.tsx            # Individual rule with controls
│   └── RuleEditor.tsx         # Create/edit rule form

app/
├── transactions/
│   └── review/
│       └── page.tsx           # Review queue page
├── rules/
│   └── page.tsx               # Rules management page
└── api/
    ├── transactions/
    │   └── categorize/
    │       └── route.ts       # Bulk categorization API
    └── rules/
        └── route.ts           # Rule CRUD API
```

## Testing Checklist

Before deploying categorization changes, verify:

- [ ] Manual categorizations persist through re-syncs
- [ ] Pending transaction categorizations survive settlement
- [ ] Rules respect priority ordering (highest wins)
- [ ] Category lock prevents automated changes
- [ ] Transfer detection correctly identifies internal vs P2P
- [ ] Bulk edit creates audit log entries
- [ ] Retroactive rule application has preview mode
- [ ] Undo batch operation fully reverts changes
- [ ] Review queue counts are accurate
- [ ] Source badges show correct provenance
- [ ] Split transactions maintain parent-child relationships
- [ ] Payee memory is created after first manual categorization

## Validation Plan

See `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` Section J for full plan.

**Phase 1: Data Validation (Days 1-4)**
1. Export 200 transactions from Plaid
2. Manually categorize as ground truth
3. Measure Plaid baseline accuracy
4. Identify top 10 miscategorization patterns
5. Draft 10 rules and test
6. Target: 80%+ accuracy with Plaid + rules

**Phase 2: Technical Smoke Tests**
1. Taxonomy smoke test (30 transactions)
2. Transfer heuristic test (50 transfers)
3. Pending→posted preservation test
4. Rule conflict detection test

## When to Reference This File

**Always reference before:**
- Creating new categorization logic
- Modifying transaction sync
- Adding rule matching conditions
- Building categorization UI
- Writing audit/provenance code
- Implementing bulk operations
- Testing categorization accuracy

**Questions this file should answer:**
- What's the categorization precedence?
- Which technical requirements (TI-01 to TI-05) apply?
- What are the MVP success metrics?
- What's deferred to Phase 2?
- Where is each piece of functionality implemented?
- What are common mistakes to avoid?
