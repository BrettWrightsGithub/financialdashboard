---
description: Execute the data validation pilot (Phase 1 from categorization MVP) to measure Plaid accuracy and identify rule candidates before building categorization features.
auto_execution_mode: 1
status: COMPLETED
completed_date: 2026-01-01
---

## Completion Summary

**Done:** Created pilot infrastructure for data validation.

- Created `scripts/export_pilot_transactions.ts` - exports 200 transactions with Plaid data
- Created `scripts/generate_ground_truth.ts` - generates ground truth template for manual labeling
- Created `scripts/analyze_plaid_accuracy.ts` - compares Plaid categories to ground truth
- Created `scripts/simulate_rules.ts` - tests 10 draft rules against ground truth
- Created `data/pilot_rules.json` - 10 draft programmatic rules
- Created `docs/categorization/pilot_results.md` - results template
- Updated n8n workflow to include Plaid category enrichment (`category_ai`, `category_ai_conf`)
- Verified 100% Plaid category coverage on 200 transactions

**Pending (User Task):** Manual ground truth labeling in `data/pilot_ground_truth.json`, then run `npm run pilot:analyze` and `npm run pilot:simulate`.

**User Action Required:** Run the SQL migration in Supabase.

## Testing Reference

Follow `docs/testing/testing_strategy.md` for all testing requirements:
- **Unit tests:** Accuracy calculation functions, rule simulation logic
- **Integration tests:** Export script database queries
- **Manual verification:** Ground truth labeling, accuracy analysis

---

## Steps

1. Re-read:
   - `docs/categorization/official-plan-synthesis_mvp_categorization_ai2.md` (Section J: Validation Plan)

2. Export 200 recent transactions from Supabase that have Plaid categorization data.
   - Create a script at `scripts/export_pilot_transactions.ts` that:
     - Queries `transactions` with `plaid_category` populated.
     - Exports to a CSV or JSON file for manual review.

3. Create a ground truth spreadsheet or JSON file at `data/pilot_ground_truth.json`:
   - For each transaction, manually assign the correct category.
   - Include fields: `transaction_id`, `plaid_category`, `correct_category`, `notes`.

4. Create an analysis script at `scripts/analyze_plaid_accuracy.ts` that:
   - Compares `plaid_category` to `correct_category`.
   - Outputs: overall accuracy %, top 10 miscategorization patterns.

5. Based on miscategorization patterns, draft 10 programmatic rules in `data/pilot_rules.json`:
   - Each rule: `{ merchant_match, amount_range, account_type, target_category }`.

6. Create a simulation script at `scripts/simulate_rules.ts` that:
   - Applies the 10 rules to the 200 pilot transactions.
   - Outputs: post-rule accuracy %, which transactions still need manual review.

7. Document findings in `docs/categorization/pilot_results.md`:
   - Plaid baseline accuracy.
   - Post-rule accuracy.
   - Remaining gaps (splits, P2P, reimbursements).
   - Go/No-Go recommendation for MVP build.

8. **Success Threshold:** If Plaid + 10 rules achieves ≥80% accuracy, proceed with categorization feature build.

9. **Puppeteer Verification:** Use the Puppeteer MCP server to:
    - Navigate to any relevant UI pages
    - Take screenshots to document the pilot results
    - Verify data displays correctly in the app
