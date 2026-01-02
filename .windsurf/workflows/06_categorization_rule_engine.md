---
description: Implement the programmatic rule engine for transaction categorization with priority ordering per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-03, FR-04).
auto_execution_mode: 1
---

## Architecture Note

Per Section L of the MVP plan, the rule engine logic lives in **Supabase stored procedures** (The Engine), not in TypeScript. The Next.js app provides a thin UI layer and API routes that call the stored procedures. N8n orchestrates bulk operations.

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-03, FR-04, TI-03, TI-04, Section L)
   - `docs/db-schema.md` for existing schema

2. Create or update the `categorization_rules` table in Supabase with columns:
   - `id` (UUID, primary key)
   - `name` (text, human-readable rule name)
   - `priority` (integer, higher = runs first)
   - `merchant_match` (text, exact or contains pattern)
   - `merchant_match_type` (enum: 'exact', 'contains', 'regex')
   - `amount_min` (numeric, optional)
   - `amount_max` (numeric, optional)
   - `account_id` (UUID, optional, FK to accounts)
   - `direction` (enum: 'debit', 'credit', 'any')
   - `target_category_id` (UUID, FK to categories)
   - `is_active` (boolean, default true)
   - `created_at`, `updated_at` timestamps

3. Add migration file to `supabase/migrations/` for the new table.

4. **The core rule matching logic is implemented in the `fn_run_categorization_waterfall` stored procedure** (see workflow 14). Create a thin TypeScript wrapper in `lib/categorization/ruleEngine.ts`:
   - `triggerCategorizationWaterfall(transactionIds: string[]): Promise<WaterfallResult>`
     - Calls the stored procedure via Supabase RPC.
     - Returns statistics from the procedure.
   - `evaluateRulesPreview(transaction: Transaction): Promise<RuleMatch | null>`
     - For UI preview only: fetches rules and simulates matching client-side.
     - Does NOT modify data.

5. Create `lib/categorization/applyRules.ts` with:
   - `categorizeTransactions(transactionIds: string[]): Promise<CategorizedResult>`
     - Calls `fn_run_categorization_waterfall` via Supabase RPC.
     - Returns `{ processed, rulesApplied, memoryApplied, plaidApplied }`.

6. Create an API route `app/api/categorization/apply-rules/route.ts`:
   - POST: Accepts batch of transaction IDs.
   - Calls the stored procedure via RPC.
   - Returns statistics from the waterfall execution.

7. Add a simple admin UI at `app/(routes)/admin/rules/page.tsx`:
   - List all rules with priority, name, conditions.
   - Add/edit/delete rules (CRUD operations on `categorization_rules` table).
   - Drag-and-drop or number input to reorder priority.

8. Write unit tests in `__tests__/categorization/ruleEngine.test.ts`:
   - Test priority ordering (highest priority wins).
   - Test each match type (exact, contains, regex).
   - Test `category_locked` transactions are skipped.
   - Test the stored procedure returns correct statistics.

9. Document the rule schema and usage in `docs/categorization/rule_engine.md`.
