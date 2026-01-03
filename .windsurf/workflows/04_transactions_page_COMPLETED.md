---
description: Build the Transactions page with master list, filters, inline editing, and flag toggles per `docs/financial-command-center-overview.md`.
auto_execution_mode: 1
---

## Steps

1. Re-read:
   - `docs/financial-command-center-overview.md` (Transactions section)
   - `docs/db-schema.md` (`transactions`, `accounts`, `categories`, `category_overrides`)

2. In `app/(routes)/transactions/page.tsx`, implement:
   - A filterable, sortable table showing: Date, Description, Category, Account, Amount.
   - Flag indicators for: Transfer, Pass-Through, Business.
   - Pagination or infinite scroll for large datasets.

3. Add filter controls for:
   - Month / custom date range picker.
   - Account dropdown (from `accounts` table).
   - Cashflow group dropdown (Income, Fixed, Variable Essentials, Discretionary, etc.).
   - Flag toggles (show/hide transfers, pass-through, business).

4. Implement inline editing:
   - Click on Category cell to open a dropdown and change category.
   - Toggle flags (is_transfer, is_pass_through, is_business) via checkboxes or switches.
   - On change, update `transactions` table and create a `category_overrides` record if category changed.
   - Set `category_locked = TRUE` when user manually overrides category.

5. Create reusable components in `components/transactions/`:
   - `<TransactionTable />` – the main table component.
   - `<TransactionRow />` – individual row with inline edit capability.
   - `<TransactionFilters />` – filter bar component.

6. Add a search box to filter by description/merchant name.

7. Ensure the table respects the `category_source` field and displays a badge ("Plaid", "Rule", "Manual") for each transaction.

8. Add loading states and error handling for Supabase queries.

9. Test inline edits persist correctly and `category_locked` prevents future rule overwrites.

10. **Puppeteer Verification:** Use the Puppeteer MCP server to:
    - Navigate to http://localhost:3000/transactions
    - Take a screenshot to verify the page renders correctly
    - Test filter interactions (date range, account, search)
    - Verify inline category editing works
    - Confirm flag indicators display properly
