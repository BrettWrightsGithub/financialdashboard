# Data Validation Pilot Results

**Status:** In Progress  
**Date Started:** 2026-01-01  
**Last Updated:** 2026-01-01

---

## Overview

This document captures the results of the data validation pilot (Phase 1 from the categorization MVP plan). The goal is to measure Plaid accuracy and identify rule candidates before building categorization features.

---

## 1. Plaid Baseline Accuracy

| Metric | Value |
|--------|-------|
| Total transactions analyzed | _TBD_ |
| Transactions with Plaid category | _TBD_ |
| Correct categorizations | _TBD_ |
| **Baseline accuracy** | _TBD%_ |

### Top Miscategorization Patterns

| # | Plaid Category | Correct Category | Count | Notes |
|---|----------------|------------------|-------|-------|
| 1 | _TBD_ | _TBD_ | _TBD_ | |
| 2 | _TBD_ | _TBD_ | _TBD_ | |
| 3 | _TBD_ | _TBD_ | _TBD_ | |
| 4 | _TBD_ | _TBD_ | _TBD_ | |
| 5 | _TBD_ | _TBD_ | _TBD_ | |

---

## 2. Programmatic Rules Applied

10 rules were drafted based on miscategorization patterns:

| Rule | Description | Priority | Matched | Accuracy |
|------|-------------|----------|---------|----------|
| Grocery Stores | Common grocery merchants | 100 | _TBD_ | _TBD%_ |
| Coffee Shops | Coffee transactions <$25 | 95 | _TBD_ | _TBD%_ |
| Gas Stations | Fuel purchases | 90 | _TBD_ | _TBD%_ |
| Streaming Subscriptions | Netflix, Spotify, etc. | 85 | _TBD_ | _TBD%_ |
| Venmo P2P | Venmo outflows | 80 | _TBD_ | _TBD%_ |
| Credit Card Payments | CC payment transfers | 100 | _TBD_ | _TBD%_ |
| Internal Transfers | Account transfers | 100 | _TBD_ | _TBD%_ |
| Restaurants | Dining and delivery | 75 | _TBD_ | _TBD%_ |
| Utilities | Utility bills | 85 | _TBD_ | _TBD%_ |
| Amazon Shopping | Amazon purchases | 70 | _TBD_ | _TBD%_ |

---

## 3. Post-Rule Accuracy

| Metric | Value |
|--------|-------|
| Transactions categorized by rules | _TBD_ |
| Transactions using Plaid fallback | _TBD_ |
| Uncategorized | _TBD_ |
| **Combined accuracy** | _TBD%_ |

---

## 4. Remaining Gaps

### Transactions Still Needing Manual Review

| Category | Count | % of Total | Notes |
|----------|-------|------------|-------|
| Splits needed (Amazon, Costco) | _TBD_ | _TBD%_ | Multi-category purchases |
| P2P ambiguous (Venmo, Zelle) | _TBD_ | _TBD%_ | Expense vs transfer unclear |
| Reimbursements | _TBD_ | _TBD%_ | Need linking to original expense |
| Other | _TBD_ | _TBD%_ | |

### Key Observations

1. **Transfers:** _TBD - How well are internal transfers detected?_
2. **P2P Payments:** _TBD - Are Venmo/Zelle correctly categorized?_
3. **Subscriptions:** _TBD - Are recurring charges identified?_
4. **Ambiguous Merchants:** _TBD - Amazon, Walmart, Costco accuracy?_

---

## 5. Go/No-Go Decision

### Success Criteria

- [ ] Plaid + 10 rules achieves ≥80% accuracy
- [ ] Transfer detection false positive rate <10%
- [ ] User review time estimated <5 min/week

### Recommendation

**Decision:** _TBD (GO / NO-GO / CONDITIONAL)_

**Rationale:**
_TBD - Fill in after running analysis scripts_

### Next Steps (if GO)

1. Implement rule engine in Supabase (workflow 06)
2. Build user override persistence (workflow 07)
3. Add transfer/reimbursement handling (workflow 08)

### Next Steps (if NO-GO)

1. Refine rules based on gap analysis
2. Consider additional data enrichment
3. Re-run pilot with updated rules

---

## Appendix

### A. Scripts Used

- `scripts/export_pilot_transactions.ts` - Export 200 transactions
- `scripts/analyze_plaid_accuracy.ts` - Measure Plaid baseline
- `scripts/simulate_rules.ts` - Test rules against ground truth

### B. Data Files

- `data/pilot_transactions.json` - Exported transactions
- `data/pilot_ground_truth.json` - Manual categorization labels
- `data/pilot_rules.json` - 10 draft rules
- `data/plaid_accuracy_results.json` - Accuracy analysis output
- `data/simulation_results.json` - Rule simulation output

### C. Category Taxonomy

Reference categories used for ground truth labeling:

- Income, Salary, Rent Income, T-Mobile Reimbursement
- Groceries, Restaurants, Coffee, Gas
- Utilities, Insurance, Subscriptions
- Shopping, Entertainment, Travel
- Healthcare, Personal Care, Gifts
- Transfer, Credit Card Payment
- Business Expense, Other
