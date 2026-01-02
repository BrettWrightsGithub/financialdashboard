# Categorization Rule Engine

**Status:** Implemented  
**Date:** 2026-01-01

---

## Overview

The rule engine provides programmatic transaction categorization based on user-defined rules. Rules are evaluated in priority order (highest first), and the first matching rule wins.

---

## Architecture

Per the MVP plan (Section L), the rule engine uses a hybrid architecture:

- **The Engine (Supabase):** Core rule matching logic lives in stored procedures for performance and data integrity.
- **The Conductor (N8n):** Orchestrates bulk operations and triggers categorization after syncs.
- **The UI (Next.js):** Provides admin interface for rule management.

---

## Database Schema

### `categorization_rules` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Human-readable rule name |
| `description` | text | Optional description |
| `priority` | integer | Higher = evaluated first |
| `is_active` | boolean | Whether rule is active |
| `match_merchant_contains` | text | Case-insensitive substring match |
| `match_merchant_exact` | text | Exact match on description |
| `match_amount_min` | numeric | Minimum amount filter |
| `match_amount_max` | numeric | Maximum amount filter |
| `match_account_id` | UUID | Filter by specific account |
| `match_account_subtype` | text | Filter by account type |
| `match_direction` | text | `inflow` or `outflow` |
| `assign_category_id` | UUID | Category to assign (FK) |
| `assign_is_transfer` | boolean | Set transfer flag |
| `assign_is_pass_through` | boolean | Set pass-through flag |

---

## Stored Procedures

### `fn_run_categorization_waterfall(p_transaction_ids UUID[])`

Main categorization function. Applies the waterfall logic:

1. **Check `category_locked`:** Skip if TRUE (user override sticks)
2. **Step 1 (Rules):** Match against `categorization_rules` by priority
3. **Step 2 (Payee Memory):** Match against `category_overrides` patterns
4. **Step 3 (Plaid):** Apply Plaid category if confidence ≥ 80%

**Returns:** JSON with statistics:
```json
{
  "processed": 50,
  "rules_applied": 30,
  "memory_applied": 10,
  "plaid_applied": 5,
  "skipped_locked": 2,
  "uncategorized": 3
}
```

### `fn_rule_matches_transaction(p_rule, p_txn)`

Helper function that checks if a rule matches a transaction. Evaluates all conditions (merchant, amount, direction, account).

---

## API Endpoints

### `POST /api/categorization/apply-rules`

Trigger categorization for transactions.

**Request Body:**
```json
// Option 1: Specific transactions
{ "transaction_ids": ["uuid1", "uuid2"] }

// Option 2: All uncategorized
{ "mode": "uncategorized" }

// Option 3: Date range
{ "mode": "date_range", "start_date": "2025-01-01", "end_date": "2025-01-31" }
```

**Response:**
```json
{
  "success": true,
  "result": {
    "processed": 50,
    "rules_applied": 30,
    "memory_applied": 10,
    "plaid_applied": 5,
    "skipped_locked": 2,
    "uncategorized": 3,
    "duration_ms": 150
  }
}
```

### `GET /api/categorization/rules`

Fetch all rules.

### `POST /api/categorization/rules`

Create a new rule.

### `PUT /api/categorization/rules`

Update a rule or batch update priorities.

### `DELETE /api/categorization/rules?id=<uuid>`

Delete a rule.

---

## Admin UI

Located at `/admin/rules`:

- List all rules with priority, conditions, and target category
- Add/edit/delete rules
- Toggle rule active/inactive
- Priority displayed as badge (P100, P50, etc.)

---

## TypeScript API

### `lib/categorization/ruleEngine.ts`

```typescript
// Trigger waterfall for transactions
triggerCategorizationWaterfall(transactionIds: string[]): Promise<WaterfallResult>

// Get all active rules
getActiveRules(): Promise<CategorizationRuleWithCategory[]>

// Preview which rule would match (client-side, no DB changes)
evaluateRulesPreview(transaction): Promise<RuleMatch | null>

// CRUD operations
createRule(rule): Promise<CategorizationRule>
updateRule(id, updates): Promise<CategorizationRule>
deleteRule(id): Promise<void>
updateRulePriorities(updates): Promise<void>
```

### `lib/categorization/applyRules.ts`

```typescript
// High-level categorization functions
categorizeTransactions(transactionIds): Promise<CategorizedResult>
categorizeUncategorized(): Promise<CategorizedResult>
categorizeByDateRange(start, end): Promise<CategorizedResult>
recategorizeByRule(ruleId): Promise<CategorizedResult>
```

---

## Rule Priority Guidelines

| Priority Range | Use Case |
|----------------|----------|
| 100+ | Critical rules (transfers, CC payments) |
| 80-99 | High-confidence merchant matches |
| 50-79 | General category rules |
| 20-49 | Fallback rules |
| 1-19 | Catch-all rules |

---

## Best Practices

1. **Be specific:** Use `match_merchant_contains` for common patterns
2. **Use priority wisely:** Higher priority = more specific rules
3. **Test before deploying:** Use the preview function to test matches
4. **Don't over-rule:** Let Plaid handle obvious categories
5. **Lock important transactions:** Use `category_locked` for manual overrides

---

## Migration

To apply the stored procedures:

```bash
# Run the migration in Supabase SQL Editor
# File: supabase/migrations/20260101_categorization_waterfall.sql
```

---

## Related Documents

- `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` - MVP plan
- `docs/db-schema.md` - Database schema
- `data/pilot_rules.json` - Draft rules from pilot
