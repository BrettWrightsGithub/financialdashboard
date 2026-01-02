---
description: Implement user override persistence and payee memory (learn from first categorization) per `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-05, FR-06).
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (FR-05, FR-06, TI-03)
   - `docs/db-schema.md` (`category_overrides`, `transactions`)

2. Ensure `transactions` table has:
   - `category_locked` (boolean, default false) – set to TRUE when user manually overrides.
   - `category_source` (enum: 'plaid', 'rule', 'manual', 'payee_memory')

3. Create or update `category_overrides` table:
   - `id` (UUID, primary key)
   - `transaction_id` (UUID, FK to transactions)
   - `original_category_id` (UUID, FK to categories)
   - `new_category_id` (UUID, FK to categories)
   - `override_source` (enum: 'manual', 'payee_memory')
   - `created_at` timestamp

4. Create `payee_category_mappings` table for payee memory:
   - `id` (UUID, primary key)
   - `payee_name` (text, normalized merchant/payee name)
   - `category_id` (UUID, FK to categories)
   - `confidence` (numeric, default 1.0)
   - `usage_count` (integer, increments each time applied)
   - `created_at`, `updated_at` timestamps

5. Add migrations for new/updated tables.

6. Create `lib/categorization/payeeMemory.ts`:
   - `getPayeeMapping(payeeName: string): { categoryId: string, confidence: number } | null`
   - `savePayeeMapping(payeeName: string, categoryId: string): void`
   - `normalizePayeeName(rawName: string): string` – lowercase, trim, remove common suffixes.

7. Update `lib/categorization/applyRules.ts`:
   - After rule engine, before Plaid fallback, check payee memory.
   - Categorization order: `category_locked` → User Rules → Payee Memory → Plaid.

8. Create `lib/categorization/userOverride.ts`:
   - `applyUserOverride(transactionId: string, newCategoryId: string): void`
     - Updates `transactions.category_id` and `transactions.category_source = 'manual'`.
     - Sets `transactions.category_locked = TRUE`.
     - Inserts record into `category_overrides`.
     - Calls `savePayeeMapping()` to learn for future transactions.

9. Update the Transactions page inline edit to call `applyUserOverride()`.

10. Write tests:
    - Override persists after re-running rules.
    - Payee memory applies to new transactions with same payee.
    - `category_locked` prevents rule/Plaid overwrites.

11. Document in `docs/categorization/user_overrides.md`.
